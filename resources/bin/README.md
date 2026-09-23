# Gömülü ikililer (portable)

Uygulama, kullanıcı hiçbir şey kurmasın diye pandoc / git / pdftotext'i buradan
sağlar. Çalışma zamanında `binPath()` **önce gömülü** ikiliye, yoksa **sistem
PATH**'ine düşer (`src/main/convert.ts`, `src/main/repo.ts`).

Beklenen yerleşim (electron-builder her platform build'ine yalnızca kendi
klasörünü `resources/bin/<platform>` olarak dahil eder):

```
resources/bin/
  linux/  pandoc   git(*)   pdftotext(*)
  mac/    pandoc   git(*)   pdftotext(*)
  win/    pandoc.exe   git/ (MinGit)   pdftotext.exe
```

(*) git ve pdftotext'in Linux/macOS'ta resmi "portable" dağıtımı yoktur; bu
platformlarda ya statik derleme koy ya da sistemdekine güven (resolver otomatik
düşer). Windows'ta ikisi de kolayca gömülür.

## İndirme kaynakları

**pandoc** — tek statik binary, en kolayı:
- https://github.com/jgm/pandoc/releases/latest
- Linux: `pandoc-<sürüm>-linux-amd64.tar.gz` → içindeki `bin/pandoc` → `resources/bin/linux/pandoc`
- macOS: `pandoc-<sürüm>-x86_64-macOS.zip` (veya arm64) → `resources/bin/mac/pandoc`
- Windows: `pandoc-<sürüm>-windows-x86_64.zip` → `pandoc.exe` → `resources/bin/win/pandoc.exe`

**git**:
- Windows: **MinGit** (PortableGit) → https://github.com/git-for-windows/git/releases
  `MinGit-<sürüm>-64-bit.zip` → `resources/bin/win/git/` (çalıştırılabilir `git/cmd/git.exe`).
  Not: `binPath('git')` şu an düz `git` arar; MinGit için resolver'a `git/cmd/git.exe`
  yolu eklenecek (paketleme sırasında ayarlanır).
- macOS/Linux: sistem git'i genelde vardır → resolver düşer. Tam portable istenirse
  statik git derlemesi konur.

**pdftotext** (poppler):
- Windows: https://github.com/oschwartz10612/poppler-windows/releases →
  `Release-<sürüm>.zip` → `Library/bin/pdftotext.exe` → `resources/bin/win/pdftotext.exe`
- macOS: `brew install poppler` çıktısındaki `pdftotext` → `resources/bin/mac/pdftotext`
- Linux: `poppler-utils` paketindeki `/usr/bin/pdftotext` (statik değil; sistemdekine
  güvenmek en pratiği).

## Hatırlatma
- xlsx/xls/ods dönüşümü **SheetJS (saf-JS)** ile yapılır — ikili gerekmez.
- Bu klasördeki `.gitkeep` dosyaları sadece klasörü git'te tutar; ikililer repoya
  commit'lenmez (büyük). Build makinesinde indirilip yerleştirilir.
