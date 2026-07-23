# オンライン人狼サーバー

オンラインでプレイできる人狼サーバーを開発。

## ゲーム詳細
game.mdを参照のこと。


## 技術スタック

* typescriptで統一する
* pnpmを使ったモノレポ構成とする

### フォルダ構成
* server
 * サーバーサイド. node.js
* shared
 * serverとfrontendで共有する型定義などを配置
* frontend
 * フロントエンド. vite + vue

### スタック詳細
* server
 * expressでファイル配信
 * ゲーム部分はsocket.ioによるリアルタイム管理を行う。タイマー管理でのゲーム進行を行えるようにする
 * ゲーム中の情報記憶はすべてインメモリ、ゲーム終了後にjsonで吐き出す。詳細はあとから検討。

* frontend
 * vite + vueでhtmlをビルドし配置。expressで配信する。

## コーディング規約
* typescriptによる型付けを最大限に活用する。
* requireは禁止し、importのみを使用する。