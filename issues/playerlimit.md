playerLimit, rolesetの扱いについて

以下のようにしたい。
* playerLimitはnpc込みの人数とする。すなわち、playerLimit=12であれば、npc1 + pc11人を限度とし、playerの参加を11人まで受け付ける。
* rolesetもnpc込みでの人数を採用する。すなわちnpc1, pc8人であれば、roleset[9]を使用して役職を割り振る。

仕様としてドキュメントに明記してほしい。