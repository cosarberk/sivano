# Gömülü ikililer (portable)

Bu klasör, uygulamaya gömülecek platforma özel çalıştırılabilir ikilileri tutar.
Kullanıcıların pandoc / git kurmasına gerek kalmaması için buradan sağlanırlar.

Beklenen yapı (ilgili adımda doldurulacak):

```
resources/bin/
  linux/
    pandoc
    git/           # portable git
  mac/
    pandoc
    git/
  win/
    pandoc.exe
    git/           # MinGit
```

Uygulama çalışırken `process.platform` değerine göre doğru ikiliyi mutlak
yoldan çağırır. Paketleme (electron-builder) her platform kurulumuna yalnızca
kendi ikililerini dahil edecek şekilde yapılandırılacaktır.
