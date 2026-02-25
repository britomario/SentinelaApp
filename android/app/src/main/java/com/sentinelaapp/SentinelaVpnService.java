package com.sentinelaapp;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.xbill.DNS.ARecord;
import org.xbill.DNS.DClass;
import org.xbill.DNS.Flags;
import org.xbill.DNS.Header;
import org.xbill.DNS.Message;
import org.xbill.DNS.Name;
import org.xbill.DNS.Record;
import org.xbill.DNS.Section;
import org.xbill.DNS.Type;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * SentinelaVpnService — DNS Sinkhole transparente e resiliente.
 *
 * Arquitetura (Split Tunnel):
 *  - Rotas /32 apenas para IPs DNS públicos → só consultas DNS entram no túnel.
 *  - addDnsServer("10.0.0.2") força o SO a enviar UDP/53 para o nosso TUN.
 *  - allowBypass() garante que todo o TCP de navegação saia direto pela rede real.
 *  - Porta 853 (DoT) descartada → força fallback para UDP/53.
 *  - Respostas DNS reconstruídas com headers IP/UDP CORRETOS (bug anterior corrigido).
 */
public class SentinelaVpnService extends VpnService {

    private static final String TAG = "SentinelaFilter";
    private static final String CHANNEL_ID = "sentinela_vpn_channel";
    private static final int   NOTIF_ID    = 1;

    private static final String VPN_ADDRESS  = "10.0.0.2";
    private static volatile String sUpstreamDns = "8.8.8.8";
    private static final int    DNS_PORT     = 53;
    private static final int    DOT_PORT     = 853;
    private static final int    MAX_PKT      = 32767;

    // Protocolo
    private static final int PROTO_TCP = 6;
    private static final int PROTO_UDP = 17;

    // Rotas /32 — somente IPs DNS públicos entram no túnel
    private static final String[] DNS_IPS = {
        "8.8.8.8",       "8.8.4.4",
        "1.1.1.1",       "1.0.0.1",
        "208.67.222.222","208.67.220.220"
    };

    // ── Blacklist (thread-safe, atualizável em runtime) ─────────────────────
    static final Set<String> sBlacklist = ConcurrentHashMap.newKeySet();
    static final Set<String> sPornKeywords = ConcurrentHashMap.newKeySet();

    static {
        sBlacklist.addAll(Arrays.asList(
            "bet365.com","betano.com","sportingbet.com","betfair.com",
            "pixbet.com","estrela.bet","esportesdasorte.com","bet7k.com",
            "blaze.com","kto.com","7games.bet","vaidebet.com",
            "novibet.com","superbet.com","parimatch.com","galera.bet",
            "f12.bet","betmotion.com","bodog.com","1xbet.com"
        ));
        sPornKeywords.addAll(Arrays.asList(
            "porn","xxx","erotic","nude","nudes","onlyfans",
            "xvideos","pornhub","xnxx","xhamster","redtube"
        ));
    }

    public static void updateBlacklist(Set<String> domains) {
        sBlacklist.clear();
        if (domains != null) {
            for (String d : domains) {
                if (d != null && !d.trim().isEmpty())
                    sBlacklist.add(d.toLowerCase(Locale.ROOT).trim());
            }
        }
        // garante defaults se lista vier vazia
        if (sBlacklist.isEmpty()) {
            sBlacklist.addAll(Arrays.asList(
                "bet365.com","betano.com","sportingbet.com","betfair.com"
            ));
        }
    }

    public static void addToBlacklist(String domain) {
        if (domain != null && !domain.trim().isEmpty())
            sBlacklist.add(domain.toLowerCase(Locale.ROOT).trim());
    }

    public static void removeFromBlacklist(String domain) {
        if (domain != null)
            sBlacklist.remove(domain.toLowerCase(Locale.ROOT).trim());
    }

    public static Set<String> getBlacklist() { return new HashSet<>(sBlacklist); }

    public static synchronized void setUpstreamDns(String upstreamDns) {
        if (upstreamDns == null) return;
        String trimmed = upstreamDns.trim();
        if (trimmed.isEmpty()) return;
        sUpstreamDns = trimmed;
    }

    public static synchronized String getUpstreamDns() {
        return sUpstreamDns;
    }

    // ── Estado do serviço ────────────────────────────────────────────────────
    private Thread               mThread;
    private ParcelFileDescriptor mInterface;
    private final AtomicBoolean  isRunning = new AtomicBoolean(false);
    private DatagramSocket       mDnsSocket;
    private InetAddress          mUpstreamDns;
    private FileOutputStream     mTunOut;
    private FileChannel          mTunIn;

    // ── Ciclo de vida ────────────────────────────────────────────────────────
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }
        startForeground();
        if (!isRunning.get()) {
            mThread = new Thread(this::runVpnLoop, "SentinelaVpnLoop");
            mThread.start();
        }
        return START_STICKY;
    }

    // ── Configuração do Builder ──────────────────────────────────────────────
    private void configureBuilder(Builder b) {
        b.setSession("Sentinela Familiar")
         .addAddress(VPN_ADDRESS, 32)
         // DNS aponta para o nosso túnel — garante captura de UDP/53
         .addDnsServer(VPN_ADDRESS)
         .allowFamily(android.system.OsConstants.AF_INET)
         .allowBypass()   // TCP de navegação sai pela rede real
         .setMtu(1500);

        // Próprio app fora do túnel para evitar loop
        try { b.addDisallowedApplication(getPackageName()); }
        catch (PackageManager.NameNotFoundException ignored) {}

        // Somente os IPs DNS entram no túnel
        for (String ip : DNS_IPS) b.addRoute(ip, 32);

        // Modo não-bloqueante disponível a partir do API 21
        try { b.setBlocking(false); }
        catch (Exception ignored) {}
    }

    // ── Loop principal ───────────────────────────────────────────────────────
    private void runVpnLoop() {
        try {
            isRunning.set(true);
            mUpstreamDns = InetAddress.getByName(getUpstreamDns());

            Builder builder = new Builder();
            configureBuilder(builder);

            mInterface = builder.establish();
            if (mInterface == null) { Log.e(TAG, "establish() returned null"); return; }

            mDnsSocket = new DatagramSocket();
            if (!protect(mDnsSocket)) Log.e(TAG, "protect(DnsSocket) FAILED");

            mTunOut = new FileOutputStream(mInterface.getFileDescriptor());
            mTunIn  = new FileInputStream(mInterface.getFileDescriptor()).getChannel();

            // DirectByteBuffer: sem pressão no GC dentro do loop
            ByteBuffer buf = ByteBuffer.allocateDirect(MAX_PKT);

            Log.i(TAG, "VPN iniciada — split-tunnel DNS ativo");

            while (isRunning.get()) {
                buf.clear();
                int len;
                try {
                    len = mTunIn.read(buf);
                } catch (IOException e) {
                    if (isRunning.get()) Log.w(TAG, "TUN read: " + e.getMessage());
                    break;
                }
                if (len <= 0) { shortSleep(); continue; }

                buf.flip();
                byte[] pkt = new byte[len];
                buf.get(pkt);
                processPacket(pkt, len);
            }
        } catch (Exception e) {
            Log.e(TAG, "Loop error", e);
        } finally {
            stopVpn();
        }
    }

    // ── Roteamento de pacotes ────────────────────────────────────────────────
    private void processPacket(byte[] pkt, int len) {
        if (len < 20) return;
        if (((pkt[0] >> 4) & 0x0F) != 4) return; // somente IPv4

        int proto      = pkt[9] & 0xFF;
        int ipHdrLen   = (pkt[0] & 0x0F) * 4;
        if (len < ipHdrLen + 4) return;

        int dstPort = u16(pkt, ipHdrLen + 2);

        // ─ Killswitch DoT: descarta porta 853 silenciosamente ─────────────
        if (dstPort == DOT_PORT) return;

        // ─ UDP ────────────────────────────────────────────────────────────
        if (proto == PROTO_UDP && len >= ipHdrLen + 8) {
            if (dstPort == DNS_PORT) handleDns(pkt, len, ipHdrLen);
            // outros UDP ignorados (não deveria chegar com split-tunnel /32)
            return;
        }

        // ─ TCP: descarta silenciosamente ──────────────────────────────────
        // Com rotas /32 DNS-only, TCP de navegação não entra no túnel.
        // O único TCP que poderia chegar seria 853 (já descartado acima).
    }

    // ── Processamento DNS ────────────────────────────────────────────────────
    private void handleDns(byte[] pkt, int len, int ipHdrLen) {
        int payloadOff = ipHdrLen + 8;
        int payloadLen = len - payloadOff;
        if (payloadLen < 12) return;

        byte[] dnsBytes = new byte[payloadLen];
        System.arraycopy(pkt, payloadOff, dnsBytes, 0, payloadLen);

        try {
            Message query = new Message(dnsBytes);
            if (query.getQuestion() == null) return;

            String domain = query.getQuestion().getName().toString(true)
                                 .toLowerCase(Locale.ROOT).replaceAll("\\.$", "");
            Log.d(TAG, "DNS? " + domain);

            if (shouldBlock(domain)) {
                Log.i(TAG, "Bloqueado: " + domain);
                emitBlocked(domain);
                byte[] wire = buildSinkhole(query);
                if (wire != null) writeDnsResponse(pkt, wire);
            } else {
                byte[] resp = forwardDns(dnsBytes);
                if (resp != null) writeDnsResponse(pkt, resp);
            }
        } catch (Exception e) {
            Log.w(TAG, "handleDns: " + e.getMessage());
        }
    }

    private boolean shouldBlock(String domain) {
        if (domain == null || domain.isEmpty()) return false;
        String d = domain.toLowerCase(Locale.ROOT).trim();

        if (d.equals("bet.br") || d.endsWith(".bet.br")) return true;
        if (d.endsWith(".bet") || d.startsWith("bet.")
                || d.contains(".bet.")
                || (d.contains("bet") && !d.contains("alphabet"))) return true;

        for (String bl : sBlacklist) {
            if (d.equals(bl) || d.endsWith("." + bl)) return true;
        }
        for (String kw : sPornKeywords) {
            if (d.contains(kw)) return true;
        }
        return false;
    }

    private byte[] buildSinkhole(Message query) {
        try {
            Header hdr = query.getHeader();
            hdr.setFlag(Flags.QR);
            hdr.setRcode(0);
            Message resp = new Message();
            resp.setHeader(hdr);
            resp.addRecord(query.getQuestion(), Section.QUESTION);
            if (query.getQuestion().getType() == Type.A
                    || query.getQuestion().getType() == Type.ANY) {
                Name q = query.getQuestion().getName();
                resp.addRecord(
                    new ARecord(q, DClass.IN, 60, Inet4Address.getByName("0.0.0.0")),
                    Section.ANSWER
                );
            }
            return resp.toWire();
        } catch (Exception e) {
            Log.e(TAG, "buildSinkhole", e);
            return null;
        }
    }

    private byte[] forwardDns(byte[] queryBytes) {
        try {
            mDnsSocket.send(new DatagramPacket(queryBytes, queryBytes.length, mUpstreamDns, DNS_PORT));
            byte[] buf = new byte[MAX_PKT];
            DatagramPacket rp = new DatagramPacket(buf, buf.length);
            mDnsSocket.setSoTimeout(3000);
            mDnsSocket.receive(rp);
            return Arrays.copyOf(rp.getData(), rp.getLength());
        } catch (IOException e) {
            Log.d(TAG, "DNS forward error: " + e.getMessage());
            return null;
        }
    }

    // ── Montagem do pacote IP/UDP de resposta ────────────────────────────────
    /**
     * Constrói a resposta DNS completa (IP + UDP + payload) a partir do pacote
     * de requisição original, invertendo corretamente src↔dst.
     *
     * Requisição (do cliente para nós):
     *   IP  src = clientIp   [bytes 12-15]
     *   IP  dst = 10.0.0.2   [bytes 16-19]
     *   UDP src = clientPort [ipHdr+0..1]
     *   UDP dst = 53         [ipHdr+2..3]
     *
     * Resposta (de nós para o cliente):
     *   IP  src = 10.0.0.2   ← inverte
     *   IP  dst = clientIp   ← inverte
     *   UDP src = 53         ← inverte
     *   UDP dst = clientPort ← inverte
     */
    private void writeDnsResponse(byte[] reqPkt, byte[] dnsPayload) {
        int ipHdrLen  = (reqPkt[0] & 0x0F) * 4;

        byte[] clientIp  = Arrays.copyOfRange(reqPkt, 12, 16); // src do request
        byte[] ourIp     = Arrays.copyOfRange(reqPkt, 16, 20); // dst do request (10.0.0.2)
        int    clientPort = u16(reqPkt, ipHdrLen);             // src port do request
        // int dnsPort  = u16(reqPkt, ipHdrLen + 2);           // sempre 53

        int udpLen   = 8 + dnsPayload.length;
        int totalLen = 20 + udpLen;
        byte[] pkt   = new byte[totalLen];

        // ── Cabeçalho IP ────────────────────────────────────────────────────
        pkt[0]  = 0x45;                          // Version=4, IHL=5
        pkt[1]  = 0;                             // DSCP/ECN
        pkt[2]  = (byte)(totalLen >> 8);
        pkt[3]  = (byte)(totalLen);
        pkt[4]  = 0; pkt[5] = 0;                // ID
        pkt[6]  = 0; pkt[7] = 0;                // Flags / Fragment offset
        pkt[8]  = 64;                            // TTL
        pkt[9]  = 17;                            // Protocol = UDP
        pkt[10] = 0; pkt[11] = 0;               // Checksum (preenchido abaixo)
        System.arraycopy(ourIp,    0, pkt, 12, 4); // IP src = 10.0.0.2
        System.arraycopy(clientIp, 0, pkt, 16, 4); // IP dst = clientIp

        // ── Cabeçalho UDP ────────────────────────────────────────────────────
        pkt[20] = (byte)(DNS_PORT    >> 8);      // UDP src = 53
        pkt[21] = (byte)(DNS_PORT       );
        pkt[22] = (byte)(clientPort  >> 8);      // UDP dst = clientPort
        pkt[23] = (byte)(clientPort     );
        pkt[24] = (byte)(udpLen >> 8);           // UDP length
        pkt[25] = (byte)(udpLen     );
        pkt[26] = 0; pkt[27] = 0;               // UDP checksum (desativado)

        // ── Payload DNS ──────────────────────────────────────────────────────
        System.arraycopy(dnsPayload, 0, pkt, 28, dnsPayload.length);

        // ── Checksum IPv4 ────────────────────────────────────────────────────
        int ck = 0;
        for (int i = 0; i < 20; i += 2) {
            if (i == 10) continue;
            ck += ((pkt[i] & 0xFF) << 8) | (pkt[i+1] & 0xFF);
        }
        while ((ck >> 16) != 0) ck = (ck & 0xFFFF) + (ck >> 16);
        ck = ~ck & 0xFFFF;
        pkt[10] = (byte)(ck >> 8);
        pkt[11] = (byte)(ck);

        try {
            mTunOut.write(pkt);
        } catch (IOException e) {
            Log.w(TAG, "TUN write: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private static int u16(byte[] b, int off) {
        return ((b[off] & 0xFF) << 8) | (b[off+1] & 0xFF);
    }

    private static void shortSleep() {
        try { Thread.sleep(1); } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    // ── Emissão de evento React Native ───────────────────────────────────────
    private void emitBlocked(String domain) {
        try {
            Application app = (Application) getApplicationContext();
            if (!(app instanceof ReactApplication)) return;
            ReactContext ctx = ((ReactApplication) app)
                .getReactNativeHost().getReactInstanceManager()
                .getCurrentReactContext();
            if (ctx == null || !ctx.hasActiveCatalystInstance()) return;

            String ts = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
            WritableMap params = Arguments.createMap();
            params.putString("domain", domain);
            params.putString("timestamp", ts);
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
               .emit("onDomainBlocked", params);
        } catch (Exception e) {
            Log.d(TAG, "emit: " + e.getMessage());
        }
    }

    // ── Notificação foreground ────────────────────────────────────────────────
    private void startForeground() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null)
                    nm.createNotificationChannel(new NotificationChannel(
                        CHANNEL_ID, "Sentinela VPN", NotificationManager.IMPORTANCE_LOW));
            }
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Sentinela")
                .setContentText("Filtro ativo")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(PendingIntent.getActivity(
                    this, 0, new Intent(this, MainActivity.class), piFlags))
                .setOngoing(true)
                .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground: " + e.getMessage());
        }
    }

    // ── Limpeza ───────────────────────────────────────────────────────────────
    private void stopVpn() {
        isRunning.set(false);
        if (mDnsSocket != null) { mDnsSocket.close(); mDnsSocket = null; }
        try { stopForeground(true); } catch (Exception ignored) {}
        if (mTunOut != null) { try { mTunOut.close(); } catch (IOException ignored) {} mTunOut = null; }
        if (mTunIn  != null) { try { mTunIn.close();  } catch (IOException ignored) {} mTunIn  = null; }
        if (mInterface != null) { try { mInterface.close(); } catch (IOException ignored) {} mInterface = null; }
        stopSelf();
    }
}
