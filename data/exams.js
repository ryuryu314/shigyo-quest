/* 士業ドパミンクエスト — 4つの本試験の定義
 *
 * 本番の段階・科目・配点・合格ライン・時間割・問題冊子の形式を、2026年11月時点で公表されている
 * 公式資料（問題冊子・答案用紙・受験案内・Q&A・合格点の発表）をもとに再現している。
 * 合格点・基準点は年度ごとに変わるので、受験前に必ず公式発表で確認すること。
 *
 * stage.kind : 'mcq'（択一）・'case'（論文・記述）・'oral'（口述）・'mixed'（司法書士の筆記：択一＋記述）
 * section    : 採点の単位。points は本番の配点、n は本番の問題数、perQ は1問あたりの時間の目安（秒）。
 * rule.type  : 合否判定の方式。js/engine.js の evalRun を参照。
 * paper      : 本番の問題冊子・時限の形式（js/engine.js の newRun と js/game.js の問題冊子・表紙・マークシートが使う）
 *   style    : 'yobi'（〔第1問〕（配点：2）・解答欄［No.1］）／'cpa'（問題1・（5点））／'shoshi'（第1問）／'benri'（【特許・実用新案】1）
 *              論文・口述は 'yobiR'・'cpaR'・'shoshiK'・'benriR'・'oral'
 *   periods  : 時限。secs に入る採点区分の問題をその時限の冊子にまとめる。min は本番の試験時間（分）、count は本番で解く問題数、
 *              time は開始〜終了の時刻（公式資料で確かめたものだけ書く）、approx は「程度」（弁理士の口述 各10分程度）。
 * carry      : 合格した段階が、次の何年分免除されるか（会計士の短答、弁理士の短答・論文、司法書士の筆記）。
 */
(function () {
  'use strict';
  const SQ = window.SQ;

  SQ.EXAMS = [
    {
      id: 'yobi', name: '司法試験予備試験', short: '予備試験', icon: '⚖', color: '#7c4dff', tint: '#f1ebfc',
      badge: '予備試験 最終合格',
      goal: '最終合格で、司法試験の受験資格（5年以内に5回まで）を得る。',
      org: '法務省（司法試験委員会）',
      carry: {},
      stages: [
        {
          id: 'tanto', name: '短答式', kind: 'mcq', when: '7月',
          lead: '法律基本7科目と一般教養のマークシート。4つの時限に分かれ、科目別の足切りはなく、合計点だけで決まる。',
          sections: [
            { id: 'minpo', name: '民法', points: 30, n: 15, perQ: 120 },
            { id: 'shoho', name: '商法', points: 30, n: 15, perQ: 120 },
            { id: 'minso', name: '民事訴訟法', points: 30, n: 15, perQ: 120 },
            { id: 'kenpo', name: '憲法', points: 30, n: 12, perQ: 150 },
            { id: 'gyosei', name: '行政法', points: 30, n: 12, perQ: 150 },
            { id: 'keiho', name: '刑法', points: 30, n: 13, perQ: 140 },
            { id: 'keiso', name: '刑事訴訟法', points: 30, n: 13, perQ: 140 },
            { id: 'kyoyo', name: '一般教養', points: 60, n: 44, perQ: 270 }
          ],
          rule: { type: 'total', line: 165, of: 270, label: '合格点 165 / 270（令和8年）' },
          paper: {
            style: 'yobi', book: '短答式試験問題集', based: '令和8年',
            periods: [
              { id: 'minji', name: '民法・商法・民事訴訟法', time: '9:45〜11:15', min: 90, count: 45, secs: ['minpo', 'shoho', 'minso'],
                real: '〔第1問〕〜〔第45問〕（民法15問・商法15問・民事訴訟法15問。各2点）' },
              { id: 'kenko', name: '憲法・行政法', time: '12:00〜13:00', min: 60, count: 24, secs: ['kenpo', 'gyosei'],
                real: '〔第1問〕〜〔第24問〕（憲法12問・行政法12問。1問2点または3点）' },
              { id: 'keiji', name: '刑法・刑事訴訟法', time: '14:15〜15:15', min: 60, count: 26, secs: ['keiho', 'keiso'],
                real: '〔第1問〕〜〔第26問〕（刑法13問・刑事訴訟法13問。1問2点または3点）' },
              { id: 'kyoyo', name: '一般教養科目', time: '16:00〜17:30', min: 90, count: 20, secs: ['kyoyo'], select: { of: 44, pick: 20 },
                real: '〔第1問〕〜〔第44問〕から20問を選んで解答（1問3点・60点満点）' }
            ]
          },
          facts: [
            '令和8年は7月19日（日）。時間割：民法・商法・民事訴訟法 9:45〜11:15（1時間30分）→ 憲法・行政法 12:00〜13:00（1時間）→ 刑法・刑事訴訟法 14:15〜15:15（1時間）→ 一般教養科目 16:00〜17:30（1時間30分）',
            '問題数（令和8年）：憲法12・行政法12・民法15・商法15・民事訴訟法15・刑法13・刑事訴訟法13。一般教養は44問から20問を選択',
            '配点：法律基本科目は各30点（1問2点か3点で、問題文に「（配点：2）」と書かれる）。一般教養は1問3点で60点。計270点',
            '部分点（令和8年の正解及び配点）：各記述の正誤を答える3点の問題は、解答欄3つなら2つ正解で1点、解答欄4つなら3つ正解で2点。部分点の基準は問題文には書かれない',
            '答案用紙：時限ごとにA4のマークシート1枚。解答欄は［No.1］からの通し番号で、各記述の正誤に1・2をつける問題は記述ごとに解答欄が分かれる',
            '一般教養：選択欄と解答欄の両方にマークする。選択欄にマークのない解答は採点されない。20題を超えて選択すると、問題番号の小さい方から20題を採点',
            '合否：合計点だけで判定し、科目別の最低点はない。令和8年の合格点は165点（令和7年は159点）'
          ]
        },
        {
          id: 'ronbun', name: '論文式', kind: 'case', when: '9月',
          lead: '事案から論点を拾い、規範を立て、あてはめて結論を出す。令和8年からパソコンで答案を入力するCBT方式。本アプリは骨組みを選んで組み立てる簡易形式。',
          sections: [
            { id: 'kenpo', name: '憲法', points: 50, perQ: 480 },
            { id: 'gyosei', name: '行政法', points: 50, perQ: 480 },
            { id: 'minpo', name: '民法', points: 50, perQ: 480 },
            { id: 'shoho', name: '商法', points: 50, perQ: 480 },
            { id: 'minso', name: '民事訴訟法', points: 50, perQ: 480 },
            { id: 'keiho', name: '刑法', points: 50, perQ: 480 },
            { id: 'keiso', name: '刑事訴訟法', points: 50, perQ: 480 },
            { id: 'sentaku', name: '選択科目', points: 50, perQ: 480 },
            { id: 'jitsumu', name: '法律実務基礎', points: 100, perQ: 480 }
          ],
          rule: { type: 'total', line: 240, of: 500, label: '合格点 240 / 500（令和7年）' },
          paper: {
            style: 'yobiR', book: '論文式試験問題集', based: '令和8年（CBT）',
            periods: [
              { id: 'kenko', name: '憲法・行政法', day: 1, time: '9:30〜11:50', min: 140, count: 2, secs: ['kenpo', 'gyosei'] },
              { id: 'keiji', name: '刑法・刑事訴訟法', day: 1, time: '13:15〜15:35', min: 140, count: 2, secs: ['keiho', 'keiso'] },
              { id: 'sentaku', name: '選択科目', day: 1, time: '16:30〜17:40', min: 70, count: 1, secs: ['sentaku'] },
              { id: 'jitsumu', name: '法律実務基礎科目（民事・刑事）', day: 2, time: '9:30〜12:30', min: 180, count: 2, secs: ['jitsumu'] },
              { id: 'minji', name: '民法・商法・民事訴訟法', day: 2, time: '14:00〜17:30', min: 210, count: 3, secs: ['minpo', 'shoho', 'minso'] }
            ]
          },
          facts: [
            '令和8年は9月12日（土）・13日（日）。1日目：憲法・行政法 9:30〜11:50（2時間20分）→ 刑法・刑事訴訟法 13:15〜15:35（2時間20分）→ 選択科目 16:30〜17:40（1時間10分）。2日目：法律実務基礎科目（民事・刑事）9:30〜12:30（3時間）→ 民法・商法・民事訴訟法 14:00〜17:30（3時間30分）',
            'CBT方式：答案はパソコンで入力。1頁23行・1行30字まで、各科目4頁（法律実務基礎は民事・刑事それぞれ4頁）。紙の試験用法文が配られる',
            '令和8年の論文式の合格発表は12月17日の予定。本アプリの合格点は令和7年の240点',
            '科目：憲法・行政法・民法・商法・民訴・刑法・刑訴・選択科目（各50点）と法律実務基礎科目（民事・刑事で100点）。計500点',
            '本アプリは「論点 → 規範 → 結論」を選んで組み立てる形式で、採点も独自'
          ]
        },
        {
          id: 'koujutsu', name: '口述', kind: 'oral', when: '翌年1月',
          lead: '試験官の質問に口頭で答える。法律実務基礎科目（民事・刑事）。詰まると助け舟が出る。',
          sections: [
            { id: 'minji', name: '民事', points: 63, perQ: 40 },
            { id: 'keiji', name: '刑事', points: 63, perQ: 40 }
          ],
          rule: { type: 'oral60', line: 119, label: '合格点 119（民事・刑事の合計、令和7年）' },
          paper: {
            style: 'oral', book: '口述試験', based: '令和9年1月',
            periods: [
              { id: 'minji', name: '法律実務基礎科目（民事）', secs: ['minji'] },
              { id: 'keiji', name: '法律実務基礎科目（刑事）', secs: ['keiji'] }
            ]
          },
          facts: [
            '令和8年の試験の口述は、令和9年1月23日（土）・24日（日）に東京都又はその周辺で実施',
            '科目：法律実務基礎科目の民事と刑事（法曹倫理を含む）',
            '採点：各科目60点を基準に上下させて評価し、合計119点以上で合格（令和7年）',
            '本アプリは「1回目で正解＝満点、助け舟の後に正解＝半分」で57〜63点に換算'
          ]
        }
      ]
    },
    {
      id: 'cpa', name: '公認会計士試験', short: '会計士', icon: '∑', color: '#1a7fd6', tint: '#e7f2fc',
      badge: '公認会計士試験 合格',
      goal: '論文式に合格すると試験合格。その後、実務経験・実務補習・修了考査を経て登録へ。',
      org: '公認会計士・監査審査会',
      carry: { tanto: 2 },
      stages: [
        {
          id: 'tanto', name: '短答式', kind: 'mcq', when: '12月・5月（年2回）',
          lead: '4科目のマークシート。1日で企業法 → 管理会計論 → 監査論 → 財務会計論。合格すると2年間は短答が免除される。',
          sections: [
            { id: 'kigyo', name: '企業法', points: 100, n: 20, perQ: 150 },
            { id: 'kanri', name: '管理会計論', points: 100, n: 18, perQ: 250 },
            { id: 'kansa', name: '監査論', points: 100, n: 20, perQ: 150 },
            { id: 'zaimu', name: '財務会計論', points: 200, n: 35, perQ: 255 }
          ],
          rule: { type: 'ratio', line: 0.70, floor: 0.40, label: '総点数の70%基準・40%未満の科目があると不合格になりうる' },
          paper: {
            style: 'cpa', book: '短答式試験問題', based: '令和8年第Ⅱ回', ink: '#ec6b3c',
            periods: [
              { id: 'kigyo', name: '企業法', time: '9:30〜10:20', min: 50, count: 20, secs: ['kigyo'],
                real: '問題1〜問題20', pts: '満点100点（問題1〜20 各5点）' },
              { id: 'kanri', name: '管理会計論', time: '11:15〜12:30', min: 75, count: 18, secs: ['kanri'],
                real: '問題1〜問題18（理論問題が先、計算問題が後）', pts: '満点100点（問題1〜8 各5点、問題9〜18 各6点）' },
              { id: 'kansa', name: '監査論', time: '13:45〜14:35', min: 50, count: 20, secs: ['kansa'],
                real: '問題1〜問題20', pts: '満点100点（問題1〜20 各5点）' },
              { id: 'zaimu', name: '財務会計論', time: '15:30〜18:00', min: 150, count: 35, secs: ['zaimu'],
                real: '問題1〜問題35（理論 → 計算（個別） → 計算（総合）の順）', pts: '満点200点（問題1〜23・25・27 各6点、問題24・26・28〜35 各5点）' }
            ]
          },
          facts: [
            '時間割（令和8年第Ⅱ回。令和9年第Ⅰ回は2026年12月13日）：企業法 9:30〜10:20（50分）→ 管理会計論 11:15〜12:30（75分）→ 監査論 13:45〜14:35（50分）→ 財務会計論 15:30〜18:00（150分）',
            '問題数・配点（令和8年第Ⅱ回）：企業法20問・監査論20問（各5点）、管理会計論18問（理論8問 各5点・計算10問 各6点）、財務会計論35問（各6点か5点）。計500点',
            '選択肢：記述ア〜エの組合せや計算結果を、1〜6の6つから一つだけ選んでマーク。複数マークは不正解',
            '令和9年の短答式から、財務会計論・管理会計論・監査論で英語による出題がある（3科目の合計で総点数の5〜6%程度）',
            '合否：総点数の70%を基準に審査会が決める。1科目でも満点の40%に満たないと不合格になることがある'
          ]
        },
        {
          id: 'ronbun', name: '論文式', kind: 'case', when: '8月',
          lead: '3日間の記述式。会計学・監査論・企業法・租税法・選択科目。本アプリは計算と理論の要点を選ぶ簡易形式。',
          sections: [
            { id: 'kaikei', name: '会計学', points: 300, perQ: 600 },
            { id: 'kansa', name: '監査論', points: 100, perQ: 600 },
            { id: 'kigyo', name: '企業法', points: 100, perQ: 600 },
            { id: 'sozei', name: '租税法', points: 100, perQ: 600 },
            { id: 'sentaku', name: '選択科目', points: 100, perQ: 600 }
          ],
          rule: { type: 'ratio', line: 0.52, floor: 0.40, label: '得点比率52%基準・40%未満の科目があると不合格になりうる' },
          paper: {
            style: 'cpaR', book: '論文式試験問題', based: '令和8年',
            periods: [
              { id: 'kansa', name: '監査論', day: 1, time: '10:30〜12:30', min: 120, secs: ['kansa'] },
              { id: 'sozei', name: '租税法', day: 1, time: '14:30〜16:30', min: 120, secs: ['sozei'] },
              { id: 'kaikeiAM', name: '会計学（午前）', day: 2, time: '10:30〜12:30', min: 120, secs: [] },
              { id: 'kaikeiPM', name: '会計学（午後）', day: 2, time: '14:30〜17:30', min: 180, secs: ['kaikei'] },
              { id: 'kigyo', name: '企業法', day: 3, time: '10:30〜12:30', min: 120, secs: ['kigyo'] },
              { id: 'sentaku', name: '選択科目', day: 3, time: '14:30〜16:30', min: 120, secs: ['sentaku'] }
            ]
          },
          facts: [
            '時間割（令和8年は8月21日〜23日）：1日目 監査論 10:30〜12:30・租税法 14:30〜16:30、2日目 会計学（午前）10:30〜12:30・会計学（午後）14:30〜17:30、3日目 企業法 10:30〜12:30・選択科目 14:30〜16:30',
            '科目：会計学300点（管理会計論・財務会計論）、監査論・企業法・租税法・選択科目（経営学・経済学・民法・統計学から1つ）各100点',
            '合否：偏差値で調整した得点比率52%を基準に審査会が決める。1科目でも40%に満たないと不合格になることがある',
            '本アプリは調整なしの得点比率で判定'
          ]
        }
      ]
    },
    {
      id: 'shoshi', name: '司法書士試験', short: '司法書士', icon: '✎', color: '#15a35c', tint: '#e8f6ee',
      badge: '司法書士試験 最終合格',
      goal: '筆記と口述に合格すると最終合格。登録して、登記・供託・裁判書類作成・簡裁訴訟代理（認定）などへ。',
      org: '法務省',
      carry: { hikki: 1 },
      stages: [
        {
          id: 'hikki', name: '筆記試験', kind: 'mixed', when: '7月',
          lead: '午前の部（択一35問）と午後の部（択一35問・記述2問）。3つの基準点をすべて超え、合計でも合格点を超える必要がある。',
          sections: [
            { id: 'gozen', name: '午前の部（択一）', points: 105, n: 35, perQ: 200 },
            { id: 'gogo', name: '午後の部（択一）', points: 105, n: 35, perQ: 100 },
            { id: 'kijutsu', name: '記述式', points: 140, n: 2, perQ: 900 }
          ],
          rule: {
            type: 'parts',
            parts: [{ sec: 'gozen', line: 84, of: 105 }, { sec: 'gogo', line: 75, of: 105 }, { sec: 'kijutsu', line: 70, of: 140 }],
            total: { line: 258, of: 350 },
            label: '基準点 84・75・70 ＋ 合格点 258 / 350（令和8年度）'
          },
          paper: {
            style: 'shoshi', book: '試験問題', based: '令和8年度',
            periods: [
              { id: 'gozen', name: '午前の部', time: '9:30〜11:30', min: 120, count: 35, secs: ['gozen'],
                real: '第1問〜第35問（全て多肢択一式・105点満点）' },
              { id: 'gogo', name: '午後の部', time: '13:00〜16:00', min: 180, count: 37, secs: ['gogo', 'kijutsu'],
                real: '多肢択一式 第1問〜第35問（105点満点）と記述式 第36問・第37問（140点満点）' }
            ]
          },
          facts: [
            '令和8年度は7月5日（日）。午前の部 9:30〜11:30（2時間）、午後の部 13:00〜16:00（3時間）',
            '午前の部：全て多肢択一式で35問・105点（1問3点）。憲法・民法・刑法・会社法（商法）',
            '午後の部：多肢択一式35問（第1問〜第35問）105点と、記述式2問（第36問 不動産登記・第37問 商業登記）140点。択一は民事訴訟法・民事保全法・民事執行法・司法書士法・供託法・不動産登記法・商業登記法',
            '解答：択一は答案用紙の番号を1か所だけ塗りつぶす。記述式は所定の答案用紙（第1欄・第2欄…の表）に黒インクで書く。添付情報は問題の【添付情報一覧】から記号で答える',
            '合否：午前択一・午後択一・記述の各基準点に届き、かつ合計が合格点以上。令和8年度は基準点84・75・70、合格点258（令和7年度は78・72・70、255）',
            '筆記に合格して口述で不合格になった場合、申請すれば次回の筆記試験が免除される'
          ]
        },
        {
          id: 'koujutsu', name: '口述試験', kind: 'oral', when: '10月',
          lead: '筆記合格者が対象。不動産登記法・商業登記法・司法書士法について口頭で問われる。',
          sections: [{ id: 'koujutsu', name: '口述', points: 100, perQ: 40 }],
          rule: { type: 'ratio', line: 0.6, label: '本アプリは6割以上で合格（実際の基準は非公表で、ほぼ全員が合格する）' },
          paper: {
            style: 'oral', book: '口述試験', based: '令和8年度',
            periods: [{ id: 'koujutsu', name: '口述試験（不動産登記法・商業登記法・司法書士法）', secs: ['koujutsu'] }]
          },
          facts: [
            '筆記試験の合格者に対して実施（令和8年度は10月）',
            '本アプリの判定は独自'
          ]
        }
      ]
    },
    {
      id: 'benri', name: '弁理士試験', short: '弁理士', icon: '✦', color: '#e8590c', tint: '#fdf0e7',
      badge: '弁理士試験 最終合格',
      goal: '短答・論文・口述に合格すると最終合格。登録して、特許・意匠・商標の出願代理や知財の専門家へ。',
      org: '特許庁（工業所有権審議会）',
      carry: { tanto: 2, ronbun: 2 },
      stages: [
        {
          id: 'tanto', name: '短答式', kind: 'mcq', when: '5月',
          lead: '60題・3時間30分の5肢択一。合計点と科目別の基準点の両方を満たす必要がある。',
          sections: [
            { id: 'tokkyo', name: '特許・実用新案', short: '特実', points: 20, n: 20, perQ: 210 },
            { id: 'isho', name: '意匠', short: '意匠', points: 10, n: 10, perQ: 210 },
            { id: 'shohyo', name: '商標', short: '商標', points: 10, n: 10, perQ: 210 },
            { id: 'joyaku', name: '条約', short: '条約', points: 10, n: 10, perQ: 210 },
            { id: 'chosaku', name: '著作権法・不正競争防止法', short: '著・不', points: 10, n: 10, perQ: 210 }
          ],
          rule: { type: 'ratio', lineAbs: 39, of: 60, floor: 0.40, label: '合格点 39 / 60・各科目40%以上（令和8年度）' },
          paper: {
            style: 'benri', book: '短答式筆記試験問題集', based: '令和8年度',
            periods: [
              { id: 'tanto', name: '短答式筆記試験', min: 210, count: 60, secs: ['tokkyo', 'isho', 'shohyo', 'joyaku', 'chosaku'],
                real: '【特許・実用新案】1〜20、【意匠】1〜10、【商標】1〜10、【条約】1〜10、【著作権法・不正競争防止法】1〜10' }
            ]
          },
          facts: [
            '令和8年度は5月17日（日）。60題・3時間30分の5肢択一（マークシート）。開始時刻などの時間割は、公告では「受験者に別途通知」とされている',
            '問題集は科目ごとに番号を振る：【特許・実用新案】1〜20、【意匠】1〜10、【商標】1〜10、【条約】1〜10、【著作権法・不正競争防止法】1〜10',
            '形式：「次のうち、正しいものは、どれか。」の1〜5から選ぶ問題と、「次の(イ)〜(ホ)のうち、正しいものは、いくつあるか。」（1つ〜5つ）の問題',
            '合否：総合得点の65%（39点）を基準とし、科目別に満点の40%（特実8点・他4点）を下回らないこと',
            '短答の合格者は、合格発表の日から2年間、短答式が免除される'
          ]
        },
        {
          id: 'ronbun', name: '論文式（必須）', kind: 'case', when: '6〜7月',
          lead: '特許・実用新案、意匠、商標の事例問題。配点の比率は2：1：1。',
          sections: [
            { id: 'tokkyo', name: '特許・実用新案', points: 200, weight: 2, perQ: 900 },
            { id: 'isho', name: '意匠', points: 100, weight: 1, perQ: 900 },
            { id: 'shohyo', name: '商標', points: 100, weight: 1, perQ: 900 }
          ],
          rule: { type: 'benri', line: 54, floor: 47, label: '平均54点基準・47点未満の科目がないこと' },
          paper: {
            style: 'benriR', book: '論文式筆記試験問題集（必須科目）', based: '令和8年度',
            periods: [
              { id: 'tokkyo', name: '特許・実用新案', min: 120, count: 2, secs: ['tokkyo'] },
              { id: 'isho', name: '意匠', min: 90, count: 1, secs: ['isho'] },
              { id: 'shohyo', name: '商標', min: 90, count: 1, secs: ['shohyo'] }
            ]
          },
          facts: [
            '令和8年度は6月28日（日）。必須科目：特許・実用新案（2時間・2題）・意匠（1時間30分）・商標（1時間30分）。試験の際、弁理士試験用法文が貸与される',
            '合否：標準偏差で調整した各科目の得点の平均（配点比率を勘案）が54点以上で、47点未満の科目がないこと。本アプリは素点で判定',
            '選択科目は免除を受ける人が多いため、本アプリでは扱わない',
            '論文式（必須科目）の合格者は、2年間、必須科目が免除される'
          ]
        },
        {
          id: 'koujutsu', name: '口述', kind: 'oral', when: '10月',
          lead: '特許・実用新案、意匠、商標の3科目を面接方式で。',
          sections: [
            { id: 'tokkyo', name: '特許・実用新案', points: 1, perQ: 40 },
            { id: 'isho', name: '意匠', points: 1, perQ: 40 },
            { id: 'shohyo', name: '商標', points: 1, perQ: 40 }
          ],
          rule: { type: 'abc', label: 'A・B・Cの3段階で、C評価が2科目以上ないこと' },
          paper: {
            style: 'oral', book: '口述試験', based: '令和8年度',
            periods: [
              { id: 'tokkyo', name: '特許・実用新案', min: 10, approx: true, count: 1, secs: ['tokkyo'] },
              { id: 'isho', name: '意匠', min: 10, approx: true, count: 1, secs: ['isho'] },
              { id: 'shohyo', name: '商標', min: 10, approx: true, count: 1, secs: ['shohyo'] }
            ]
          },
          facts: [
            '令和8年度は10月17日（土）〜19日（月）のうちいずれかの日。3科目を各10分程度の面接方式で、受験者が科目ごとの試験室を順に移る',
            '試験室にあらかじめ用意された弁理士試験用法文を、試験委員の許可を受けて参照できる',
            '合否：A・B・Cのゾーン評価で、C評価が2科目以上ないこと',
            '本アプリは正答率80%以上をA、50%以上をB、それ未満をCとする'
          ]
        }
      ]
    }
  ];
})();
