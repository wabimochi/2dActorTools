# 2dActorTools
Adobe Premiere Proの立ち絵編集と字幕入力をサポートするエクステンションです。
CC2021でのみ動作確認してます。
このエクステンションは日本語環境でのみ動作を確認してます。

※現在日本版のExManCmdが消えてます。末尾のjpを消したものはダウンロードできるのでそちらをお試しください
https://www.adobe.com/go/ExManCmdWin

# 使い方
https://www.nicovideo.jp/watch/sm37711233

# インストール方法
[コマンドラインツールでエクステンションをインストールする](https://helpx.adobe.com/jp/creative-cloud/kb/installingextensionsandaddons.html#Install_extensions_command_line_tool)に書いてある手順を参考にしてください。
zxpファイルは[Release](https://github.com/wabimochi/2dActorTools/releases)からダウンロードできます。
サンプルのMGTファイルは[こちら](https://github.com/wabimochi/2dActorTools/releases/tag/v1.0)

## プロジェクト
「2dActorTools」と「モーショングラフィックステンプレートメディア」というビンは移動させたり、名前を変更したりしないでください。動作しなくなります。

## 字幕
### プロパティー名
色のプロパティー名には「カラー」という名前が含まれている必要があります。
逆に色以外のプロパティー名に「カラー」が含まれてはいけません。
Aeのほうでプロパティー名が変更できるのでこの点にご注意ください。

### 字幕クリップがしましまになって字幕が表示されない
コンポジションの長さが関係してます。
サンプルのMGTファイルは3分になってるので、一つのクリップで3分以上は表示できません。

## 立ち絵
### clip not foundって出る
ビンやクリップの名前を変更した可能性があります。
もしくは、設定時に増やしたビンを別プロジェクトでは増やしてないなど。

### サムネイルが？マークになる
サムネイル画像を移動したり消したりした可能性があります。
立ち絵設定で設定開始してそのまま保存すると、再度サムネイルの保存先を尋ねられるので、もう一度生成してください。

### 立ち絵の表示タイミングがおかしい
### 何のエラーも出ないのに立ち絵が表示されない
Premiereのバージョンによってクリップのフレームがズレることがあります。
バージョンや再現手順をIssueの方にお願いします。

### 立ち絵構成の変更について
編集途中でグループ内のクリップの順番を変えるのは問題ありません。
グループの順番を変えたり追加、削除したりするとちょっとおかしくなるかもしれません。

# 未署名のエクステンションを使用する
zxpファイルに取り込まれていない修正などを使用したいときは、未署名のエクステンションを使用します。参考：https://github.com/Adobe-CEP/Samples/tree/master/PProPanel
1. PowerShellを開いて次のコマンドを入力します。`CSXS.9`の数字はPremiereのバージョンにより異なります。14.4以降は`CSXS.10`になります。詳細は [CEP-Resources](https://github.com/Adobe-CEP/CEP-Resources)の各バージョンのDocumentationから確認してください。
```
Set-ItemProperty -Path HKCU:\SOFTWARE\Adobe\CSXS.9 -Name PlayerDebugMode -Value 1
```
2. このページ右上のCodeと書いてある緑色のボタンを押し、Download ZIPでダウンロードします。
3. 展開したフォルダを`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`に移動します。
4. Premiere Proを再起動します。
