# Android Release Signing (Play Store)

Para publicar na Play Store, é necessário assinar o app com um keystore de produção.

## 1. Gerar o keystore (uma vez)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/upload-key.keystore \
  -alias upload-key \
  -keyalg RSA -keysize 2048 -validity 10000
```

Responda às perguntas e guarde a senha em local seguro. **Nunca commite o keystore nem as senhas.**

## 2. Configurar gradle.properties

Adicione em `android/gradle.properties` (ou crie `android/gradle.properties.local` e inclua no .gitignore):

```properties
MYAPP_UPLOAD_STORE_FILE=upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=upload-key
MYAPP_UPLOAD_STORE_PASSWORD=sua_senha
MYAPP_UPLOAD_KEY_PASSWORD=sua_senha
```

Para CI (GitHub Actions), use variáveis de ambiente e passe via `-P`:

```bash
./gradlew bundleRelease \
  -PMYAPP_UPLOAD_STORE_FILE=upload-key.keystore \
  -PMYAPP_UPLOAD_KEY_ALIAS=upload-key \
  -PMYAPP_UPLOAD_STORE_PASSWORD=$ANDROID_KEYSTORE_PASSWORD \
  -PMYAPP_UPLOAD_KEY_PASSWORD=$ANDROID_KEY_PASSWORD
```

## 3. Gerar o AAB

```bash
cd android && ./gradlew bundleRelease
```

O arquivo estará em `android/app/build/outputs/bundle/release/app-release.aab`.

## 4. .gitignore

Certifique-se de que `*.keystore`, `gradle.properties.local` e credenciais não sejam versionados.
