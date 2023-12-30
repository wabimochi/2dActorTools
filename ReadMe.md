# 2dActorTools
Adobe Premiere Proの立ち絵編集と字幕入力をサポートするエクステンションです。WindowsとMacで使用できます。  
このエクステンションは最新のPremiere Proで動作することを目指しています。

# 使い方
（ユーザーガイド）https://wabimochi.github.io/2dActorTools/index.html  
（動画）https://www.nicovideo.jp/watch/sm37711233

# インストール方法
[ユーザーガイドのインストール](https://wabimochi.github.io/2dActorTools/src/installation.html)をご覧ください

# 注意事項
「2dActorTools」と「モーショングラフィックステンプレートメディア」というビンは移動させたり、名前を変更したりしないでください。動作しなくなります。

# 未署名のエクステンションを使用する
zxpファイルに取り込まれていない修正などを使用したいときは、未署名のエクステンションを使用します。参考：https://github.com/Adobe-CEP/Samples/tree/master/PProPanel  
1. PowerShellを開いて次のコマンドを入力します。`CSXS.9`の数字はPremiereのバージョンにより異なります。14.4以降は`CSXS.10`になります。詳細は [CEP-Resources](https://github.com/Adobe-CEP/CEP-Resources)の各バージョンのDocumentationから確認してください。
```
Set-ItemProperty -Path HKCU:\SOFTWARE\Adobe\CSXS.9 -Name PlayerDebugMode -Value 1
```
2. このページ右上のCodeと書いてある緑色のボタンを押し、Download ZIPでダウンロードします。
3. 展開したフォルダを`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`に移動します。
4. Premiere Proを再起動します。
