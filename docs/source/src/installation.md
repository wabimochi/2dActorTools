# エクステンションのインストール

UPIAコマンドラインツール、またはExManコマンドラインツールを使用してインストールします。  
ExManコマンドラインツールを使用するには[コマンドラインツールでエクステンションをインストールする](https://helpx.adobe.com/jp/creative-cloud/kb/installingextensionsandaddons.html#Install_extensions_command_line_tool){.new_tab}に書いてある手順を参考にしてください。  

## ZXPファイルのダウンロード
[GithubのRelease](https://github.com/wabimochi/2dActorTools/releases){.new_tab}から`2dActorTools.zxp`をダウンロードしてください。

## UPIAコマンドラインツールを使用してインストールする
UPIA コマンドラインツールは、Creative Cloud デスクトップアプリバージョン 5.5 以降で自動的にインストールされています。

### Windows
`2dActorTools.zxp`があるフォルダを`C:\Users\(ユーザー名)\Downloads`とします。
1. スタート > `cmd`と入力 > コマンドプロンプトを選択します。
2. 次のコマンドでカレントディレクトリを変更します。
```shell
cd "C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent"
```
3. 次のコマンドを実行し、インストールします。
```shell
UnifiedPluginInstallerAgent.exe /install "C:\Users\(ユーザー名)\Downloads\2dActorTools.zxp"
```

### MacOS
`2dActorTools.zxp`があるフォルダを`/Users/(ユーザー名)/Downloads`とします。
1. {kbd}`command⌘`+{kbd}`Space`でSpotlight検索を出します。
2. `ターミナル`と入力し、`ターミナル.app`を開きます。
3. 次のコマンドでカレントディレクトリを変更します。
```shell
cd "/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS"
```
4. 次のコマンドを実行し、インストールします。
```shell
./UnifiedPluginInstallerAgent --install "/Users/(ユーザー名)/Downloads/2dActorTools.zxp"
```

## エクステンションの開き方
1. Premiere Proを開きます。
2. ツールバーから`ウィンドウ` > `エクステンション` > `2D Actor Tools`を選択します。