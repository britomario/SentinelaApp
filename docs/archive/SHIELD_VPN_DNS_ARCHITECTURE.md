# Shield, VPN, DNS Architecture — Documentation

This document describes the Sentinela VPN/DNS shield architecture, where native modules and services are used, and how shield status appears in the UI.

---

## 1. VpnModule and SentinelaVpnService — Usage Map

### Native layer (Android)

| Component | Location | Role |
|-----------|----------|------|
| **VpnModule** | `android/app/src/main/java/com/sentinelaapp/VpnModule.java` | React Native bridge — exposes VPN control and DNS configuration to JS |
| **SentinelaVpnService** | `android/app/src/main/java/com/sentinelaapp/SentinelaVpnService.java` | Android `VpnService` — DNS sinkhole that intercepts DNS queries and applies blacklist/whitelist |
| **SentinelaPackage** | `android/app/src/main/java/com/sentinelaapp/SentinelaPackage.java` | Registers `VpnModule` for the React Native app |
| **AndroidManifest** | `android/app/src/main/AndroidManifest.xml` | Declares `SentinelaVpnService` |

### VpnModule API (exposed to JS)

| Method | Purpose |
|--------|---------|
| `startVpn(pin)` | Starts VPN (requires PIN if configured; may show OS VPN consent) |
| `stopVpn(pin)` | Stops VPN |
| `setUpstreamDns(upstreamDnsIp)` | Sets fallback DNS IP for VPN |
| `setNextDnsDotHost(dotHost)` | Sets NextDNS DoT host for profile-aware filtering |
| `getUpstreamDns()` | Returns current upstream DNS IP |
| `isVpnActive()` | Returns whether VPN is currently running |
| `updateBlacklist(domains)` | Updates blacklist in `SentinelaVpnService` |
| `updateWhitelist(domains)` | Updates whitelist in `SentinelaVpnService` |
| `addToBlacklist(domain)` | Adds a single domain to blacklist |
| `removeFromBlacklist(domain)` | Removes a domain from blacklist |
| `openPrivateDnsSettings()` | Opens Android Private DNS settings (for light mode) |

### Where VpnModule is used (JS/TS)

| File | Usage |
|------|-------|
| **ConfigScreen.tsx** | `VpnModule?.openPrivateDnsSettings?.()` — opens Private DNS when applying DNS config in light mode |
| **shieldService.ts** | Main consumer: `startVpn`, `stopVpn`, `isVpnActive`, `setUpstreamDns`, `setNextDnsDotHost`, `updateBlacklist`, `updateWhitelist` |

### Where SentinelaVpnService is used (native only)

- **VpnModule.java** — starts the service via `Intent`, delegates blacklist/whitelist updates, and reads `isVpnActive()` / `getUpstreamDns()` from the service.

### Security

- PIN validation for start/stop: `SecurityModule.validatePinForVpn(context, pin)`
- VPN permission: handled via `VpnService.prepare()` and `onActivityResult`

---

## 2. shieldService, DNS Profiles, NextDNS Integration

### shieldService (`src/services/shieldService.ts`)

Main orchestrator for the VPN-based shield.

**Storage keys:**
- `@sentinela/shield_status` — `ShieldStatus` (enabled, paused, vpnActive, profileId, updatedAt)
- `@sentinela/shield_profile` — `ShieldProfile` (id, name, provider, dotHost, dohUrl, fallbackDnsIp)

**Events:**
- `sentinela.shield_status_changed` — emitted when shield status changes

**Key functions:**

| Function | Behavior |
|----------|----------|
| `activateShield(pin)` | Sets upstream DNS, NextDNS DoT host (if provider=nextdns), syncs blacklist/whitelist from manualDomainListService, starts VPN |
| `deactivateShield(pin)` | Stops VPN and updates status |
| `toggleShield(nextEnabled, pin)` | Calls `activateShield` or `deactivateShield` |
| `getShieldStatus()` | Reads native `VpnModule.isVpnActive()` and merges with stored status |
| `setShieldProfile(profile)` | Persists profile to AsyncStorage |
| `syncBlacklistToShield()` | If shield is active, pushes blacklist/whitelist to VpnModule |
| `restoreShieldFromStorage()` | Reactivates shield if `enabled` but VPN not active |
| `getShieldErrorMessage(error)` | Maps shield errors to user-facing messages |

**NextDNS integration:**
- If `profile.provider === 'nextdns'` and `profile.dotHost` exists, calls `VpnModule.setNextDnsDotHost(dotHost)` before starting VPN.
- DoH validation uses `profile.dohUrl` for DNS validation in ConfigScreen.

### DNS Profiles (`src/services/dnsProfiles.ts`)

Profiles define providers, DoT hosts, DoH URLs, and fallback IPs:

| Profile ID | Name | Provider | Policy Tags |
|------------|------|----------|-------------|
| `nextdns-family` | NextDNS Family | nextdns | adult, gambling, malware, suspicious |
| `adguard-family` | AdGuard Family | adguard | adult, gambling, malware |
| `cloudflare-family` | Cloudflare Families | cloudflare | adult, malware |
| `opendns-familyshield` | OpenDNS FamilyShield | cleanbrowsing | adult, proxy-vpn, malware, gambling |

Each profile has:
- `dotHost` — DoT hostname
- `dohUrl` — DoH URL for validation
- `fallbackDnsIp` — upstream when DoT fails

### NextDNS backend sync (dnsPolicyService)

- **Endpoint:** `POST /api/dns/profile-sync`
- **Env:** `NEXTDNS_PROFILE_ID`, `NEXTDNS_API_KEY` (used by backend, not directly by app)
- **Flow:** `syncDnsPolicyForChild(childId, profile)` is called from ConfigScreen before applying DNS; backend can sync rules to the NextDNS profile.

---

## 3. ConfigScreen Tabs and DNS-Related UI

### Tabs

ConfigScreen has 4 tabs: `dns` | `apps` | `tasks` | `manual`.

| Tab | Content |
|-----|---------|
| **dns** | DnsToggle component — DNS profile selection, mode (light/advanced), custom host, apply button, validation card |
| **apps** | App blocking (accessibility, anti-tampering, AppList) |
| **tasks** | Child tasks with rewards |
| **manual** | Blacklist/whitelist domain management |

Tabs can be opened with `route.params?.initialTab`.

### DNS-related UI (in `dns` tab)

- **DnsToggle** — mode switch (light/advanced), profile cards (DNS_PROFILES), custom DoT/DoH inputs, “Aplicar perfil DNS” button
- **Validation card** — shows after apply: “Proteção confirmada” or “Validação pendente”
- **Shield toggle** — in header (shared across tabs): status pill + Switch for Proteção Ativa / Proteção Pausada

### DnsToggle component (`src/components/settings/DnsToggle.tsx`)

- “Proteção Ativa no Dispositivo” badge when `dnsProtectionApplied`
- Mode: “Modo leve (DoT nativo)” — uses native Private DNS
- Profile cards for each `DNS_PROFILES` entry
- “Usar host customizado” for custom DoT/DoH
- “Aplicar perfil DNS” triggers parent’s `applyDnsConfig`

---

## 4. manualDomainListService Usage

**Location:** `src/services/manualDomainListService.ts`

**Storage:** `@sentinela/manual_domain_lists` — JSON `{ blacklist: string[], whitelist: string[] }`

### API

| Function | Purpose |
|----------|---------|
| `getManualDomainLists()` | Returns blacklist/whitelist from AsyncStorage |
| `addDomainToList(domainInput, 'blacklist' | 'whitelist')` | Adds domain and removes from opposite list |
| `removeDomainFromList(domainInput, target)` | Removes domain from blacklist or whitelist |

### Where used

| File | Usage |
|------|-------|
| **ConfigScreen.tsx** | `getManualDomainLists`, `addDomainToList`, `removeDomainFromList` — manual tab; after add/remove, calls `syncBlacklistToShield()` |
| **shieldService.ts** | `getManualDomainLists()` — before activate and in `syncBlacklistToShield()`; passes lists to `VpnModule.updateBlacklist/updateWhitelist` |

Manual lists are always synced to the VPN when the shield is active.

---

## 5. “Proteção Ativada” / Shield Status UI

### Status labels

| Label | Condition | Location |
|-------|-----------|----------|
| **Proteção Ativa** | `shieldStatus.enabled && shieldStatus.vpnActive` | ConfigScreen (statusLabel), DashboardScreen |
| **Proteção Pausada** | `!protectionActive` | ConfigScreen |
| **Proteção Ativa no Dispositivo** | `dnsProtectionApplied` | DnsToggle (DNS validation badge) |

### ConfigScreen (`src/screens/parents/ConfigScreen.tsx`)

- **statusLabel:** `protectionActive ? 'Proteção Ativa' : 'Proteção Pausada'`
- Pill: green border/dot when active, orange when paused
- Switch toggles shield via `executeWithPinForShield`
- Uses `useShieldStatus()` for `shieldStatus` and `refreshShieldStatus`

### DashboardScreen (`src/screens/parents/DashboardScreen.tsx`)

- **shieldActive:** `shieldStatus.enabled && shieldStatus.vpnActive`
- Pill text: `shieldActive ? 'Proteção Ativa' : 'Proteção Pausada'`
- Escudo Principal card text varies by shield state
- Toggle via `executeWithPinForShield`

### DnsToggle (`src/components/settings/DnsToggle.tsx`)

- “Proteção Ativa no Dispositivo” shown when `dnsProtectionApplied` is true (DoT validation passed).

### useShieldStatus hook (`src/hooks/useShieldStatus.ts`)

- Exposes `shieldStatus` and `refreshShieldStatus`
- Subscribes to `SHIELD_STATUS_EVENT`
- Calls `restoreShieldFromStorage()` on mount to restore shield if it was enabled before app restart

---

## Summary diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ConfigScreen / DashboardScreen                                   │
│   - useShieldStatus() → shieldStatus, refreshShieldStatus         │
│   - "Proteção Ativa" / "Proteção Pausada" pill + Switch          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ shieldService                                                    │
│   - activateShield / deactivateShield / toggleShield             │
│   - getShieldProfile (dnsProfiles)                               │
│   - getManualDomainLists → VpnModule.updateBlacklist/Whitelist  │
│   - VpnModule.setUpstreamDns, setNextDnsDotHost, startVpn/stopVpn │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ VpnModule (native)                                               │
│   - startVpn / stopVpn → SentinelaVpnService                     │
│   - updateBlacklist / updateWhitelist → SentinelaVpnService       │
│   - setNextDnsDotHost, setUpstreamDns                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SentinelaVpnService (Android VpnService)                         │
│   - DNS sinkhole: intercepts UDP/53, applies blacklist/whitelist │
│   - Uses NextDNS DoT host when configured                        │
└─────────────────────────────────────────────────────────────────┘
```
