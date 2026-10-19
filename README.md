# Nextzen

Nextzen, yazılım geliştirme, otomasyon ve sistem yönetimi işlerini riskiyle birlikte planlayan bir görev konsoludur. Ürün dili Türkçedir. Arayüz İngilizceye geçebilir. Komutlar ve betikler yalnızca metin olarak gösterilir; uygulama bunları çalıştırmaz.

Bu depo, doğrulanmış çalışma ortamında **TanStack Start, React, TypeScript ve Tailwind CSS** ile kuruludur. Önizleme ve Vercel dağıtımı bu yığın üzerindedir. Ayrı bir Next.js uygulaması eklenmedi.

## Temel özellikler

- Genel bakış, üç çalışma alanı ve gerçek görev kayıtlarından üretilen özet
- Görev formu: başlık, açıklama, kategori, işletim sistemi, teknoloji, ayrıntı, güvenli önizleme, proje bağlamı
- Yazılım, otomasyon ve sistem yönetimi odaklı sayfalar
- Yapılandırılmış sonuç: özet, varsayım, plan, risk, komut, kurulum, doğrulama, geri alma, uyarı
- Risk motoru. Model, yüksek riski düşüremez
- Yüksek riskte açık inceleme onayı. Onay, işlemin yapıldığı anlamına gelmez
- Geçmiş: arama, kategori ve risk süzgeci, yeniden açma, kopyalama, Markdown / JSON / düz metin, onaylı silme
- Açık, koyu ve sistem teması
- xAI Grok (`grok-4.5`) sunucu adaptörü. Anahtar yoksa etiketlenmiş Demo Modu

## Teknoloji yığını

- TanStack Start ve TanStack Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zod
- Node.js test çalıştırıcısı
- Playwright (mobil görüntü ölçümü, geliştirme bağımlılığı)
- ESLint ve Prettier
- GitHub Actions
- Vercel

## Sistem gereksinimleri

- Node.js 22
- npm 10 veya üzeri (bu depo `package-lock.json` kullanır; başka paket yöneticisi eklemeyin)

## Repository'yi klonlama

```bash
git clone https://github.com/zeze20/Nextzen.git
cd Nextzen
```

## Bağımlılıkları kurma

```bash
npm ci
```

## Ortam değişkenlerini hazırlama

Linux ve macOS:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`XAI_API_KEY` boş bırakılırsa uygulama Demo Modunda açılır. Anahtar yalnızca sunucuda okunur. Ayrıntı için bir sonraki bölüme bakın.

## Development modunda çalıştırma

```bash
npm run dev
```

Geliştirme sunucusu `0.0.0.0:8080` adresini dinler.

## Production build alma

```bash
npm run build
```

Anahtar olmadan derleme tamamlanır. Derleme sırasında veritabanı adresi yoksa migrasyon atlanır.

## Testleri çalıştırma

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` birim testlerini çalıştırır. Harici modele giden testler sahte `fetch` kullanır. Gerçek xAI çağrısı birim testlerinin parçası değildir.

## Mobil testleri çalıştırma

Önce geliştirme sunucusunu başlatın. Ardından:

```bash
npm run test:mobile
```

Bu komut 320, 375, 768 ve 1280 pikselde sayfa taşmasını, mobil menüyü, geçersiz formu, yüksek risk panelini, kod kopyalamayı ve tema değişimini kontrol eder. Playwright geliştirme bağımlılığıdır. Tarayıcı eksikse:

```bash
npx playwright install chromium
```

## Vercel paneliyle dağıtım

1. [Vercel](https://vercel.com) içinde **Add New Project** seçin.
2. `zeze20/Nextzen` deposunu bağlayın.
3. Framework tanınmazsa Build Command `npm run build`, Output tanımını depodaki Nitro / TanStack ayarına bırakın.
4. Environment Variables bölümüne sunucu değişkeni `XAI_API_KEY` ekleyin. `NEXT_PUBLIC_` veya `VITE_` öneki kullanmayın.
5. İsteğe bağlı `XAI_MODEL` değerini `grok-4.5` bırakın.
6. Deploy edin.
7. Açılan adreste yeni görev, geçmiş ve ayarlar akışını deneyin.

## Vercel CLI ile dağıtım

```bash
npx vercel login
npx vercel link
npx vercel env add XAI_API_KEY production
npx vercel --prod
```

CLI kimliği bu çalışma oturumunda doğrulanmadıysa önce `npx vercel login` gerekir.

## Kurulum sonrası kontrol listesi

- Genel bakış açılıyor ve boş geçmişte sahte istatistik yok
- Geçersiz form gönderilmiyor
- Geçerli görev sonuç üretiyor
- Demo Modu gerçek model gibi etiketlenmiyor
- Yüksek riskli metin onay paneli açıyor
- Geçmiş kaydı açılıyor, kopyalanıyor ve dışa aktarılıyor
- Tema değişiyor
- 320 piksel genişlikte sayfa yatay taşmıyor

## Sorun giderme

- **Node.js sürüm uyumsuzluğu:** `node -v` çıktısı 22 ile başlamalı. Eski Node ile kurulum veya derleme kırılabilir.
- **Bağımlılık kurulum hatası:** `node_modules` klasörünü silip `npm ci` çalıştırın. `npm`, `pnpm` ve `yarn` kilit dosyalarını karıştırmayın.
- **Eksik ortam değişkeni:** Uygulama açılır. Ayarlar sayfası Demo Modunu gösterir. Gerçek model için `XAI_API_KEY` gerekir.
- **Geçersiz API anahtarı:** Görev formu kontrollü bir sağlayıcı hatası gösterir. Anahtar günlükte veya arayüzde tekrarlanmaz.
- **API hız sınırı:** Kısa süre sonra yeniden deneyin. Uygulama da dakika başına istek sınırı uygular.
- **Kullanımdaki port:** 8080 doluysa diğer süreci kapatın veya geçici olarak farklı bir port vermeyin; bu projenin önizleme sözleşmesi 8080'dır.
- **Build hatası:** `npm run typecheck` ve `npm run lint` çıktısındaki ilk hatayı giderin. `NODE_ENV` zorlaması gerekmez.
- **Eksik Playwright tarayıcısı:** `npx playwright install chromium`
- **Vercel dağıtım hatası:** Proje kökünün bu depo olduğunu, build komutunun `npm run build` olduğunu ve gizli değişkenin sunucu kapsamında olduğunu kontrol edin.
- **Mobil cihazdan yerel sunucuya bağlantı:** Bilgisayar ve telefon aynı ağdaysa geliştirme makinesinin yerel IP adresi ve 8080 portu kullanılır. Güvenlik duvarı porta izin vermelidir.

## Güvenlik notları

- API anahtarını koda, `VITE_` değişkenine veya tarayıcı deposuna yazmayın.
- Model çıktısı şema ve risk tabanından geçer. HTML olarak yorumlanmaz.
- Kullanıcı metni ve yapıştırılan bağlam, sistem kurallarını değiştiremez.
- Yüksek riskli komut otomatik çalıştırılmaz ve çalıştırılmış gibi gösterilmez.
- Silme ve geçmişi temizleme onay ister.
- İstekler aynı kaynak dışından gelen betik çağrılarına kapatılır ve hız sınırına tabidir.

## Proje klasör yapısı

```text
src/routes/            sayfalar
src/components/nextzen arayüz
src/lib/nextzen        model, risk, demo, dışa aktarma, depolama
src/styles.css         tasarım belirteçleri
server/middleware      güvenlik başlıkları ve platform PWA
scripts/               ortam, önizleme ve mobil ölçüm
public/                favicon ve paylaşım kartı
.github/workflows/ci.yml
```

## Kullanılabilir package.json scriptleri

- `npm run dev` — geliştirme sunucusu
- `npm run build` — production derleme
- `npm run build:dev` — development modunda derleme
- `npm run preview` — derlenmiş çıktıyı önizleme
- `npm run preview:restart` — önizleme sunucusunu yeniden başlatma
- `npm run preview:stop` — önizleme sunucusunu durdurma
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm run format` — Prettier yazma
- `npm test` — birim testleri
- `npm run test:mobile` — görüntü genişliği ve mobil akış
- `npm run check:auth` — kimlik bayrağı karşılaştırması
- `npm run db:migrate` — `DATABASE_URL` varsa migrasyon. Nextzen şema eklemez

## Bilinen sınırlamalar

- Çok kullanıcılı hesap, ekip alanı ve sunucuda kalıcı görev arşivi yok. Geçmiş tarayıcıdadır.
- Uzak sunucuda komut çalıştırma, gerçek terminal ve otonom ajan yok.
- Ücretli bulut kaynağı oluşturulmaz.
- Demo Modu gerçek model yanıtı değildir.
- Mobil ölçüm yerel Playwright ile yapılır. CI içinde E2E koşturulmaz.
- Lisans belirlenmemiştir.

## Lisans

Bu depoda lisans dosyası yoktur. Lisans, depo sahibi tarafından belirlenene kadar tanımlanmamıştır. Kullanıcı adına lisans seçilmedi.
