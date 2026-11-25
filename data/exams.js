/* 士業ドパミンクエスト — 4つの本試験の定義
 *
 * 本番の段階・科目・配点・合格ラインを、2026年11月時点で公表されている情報をもとに再現している。
 * 合格点・基準点は年度ごとに変わるので、受験前に必ず公式発表で確認すること。
 *
 * stage.kind : 'mcq'（択一）・'case'（論文・記述）・'oral'（口述）・'mixed'（司法書士の筆記：択一＋記述）
 * section    : 採点の単位。points は本番の配点、perQ は1問あたりの時間の目安（秒）。
 * rule.type  : 合否判定の方式。js/engine.js の judgeStage を参照。
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
          lead: '法律基本7科目と一般教養のマークシート。科目別の足切りはなく、合計点だけで決まる。',
          sections: [
            { id: 'minpo', name: '民法', points: 30, perQ: 120 },
            { id: 'shoho', name: '商法', points: 30, perQ: 120 },
            { id: 'minso', name: '民事訴訟法', points: 30, perQ: 120 },
            { id: 'kenpo', name: '憲法', points: 30, perQ: 150 },
            { id: 'gyosei', name: '行政法', points: 30, perQ: 150 },
            { id: 'keiho', name: '刑法', points: 30, perQ: 140 },
            { id: 'keiso', name: '刑事訴訟法', points: 30, perQ: 140 },
            { id: 'kyoyo', name: '一般教養', points: 60, perQ: 270 }
          ],
          rule: { type: 'total', line: 159, of: 270, label: '合格点 159 / 270（令和7年）' },
          facts: [
            '時間割：民法・商法・民訴 1時間30分 → 憲法・行政法 1時間 → 刑法・刑訴 1時間 → 一般教養 1時間30分',
            '配点：法律基本科目は各30点（各10〜15問程度）、一般教養は60点（1問3点）。計270点',
            '合否：合計点だけで判定し、科目別の最低点はない。令和7年の合格点は159点'
          ]
        },
        {
          id: 'ronbun', name: '論文式', kind: 'case', when: '9月',
          lead: '事案から論点を拾い、規範を立て、あてはめて結論を出す。本アプリは骨組みを選んで組み立てる簡易形式。',
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
          facts: [
            '科目：憲法・行政法・民法・商法・民訴・刑法・刑訴・選択科目（各50点）と法律実務基礎科目（民事・刑事で100点）。計500点',
            '本番は答案を書く試験。本アプリは「論点 → 規範 → 結論」を選んで組み立てる形式で、採点も独自'
          ]
        },
        {
          id: 'koujutsu', name: '口述', kind: 'oral', when: '翌年1月',
          lead: '試験官の質問に口頭で答える。法律実務基礎科目（民事・刑事）。詰まると助け舟が出る。',
          sections: [
            { id: 'minji', name: '民事', points: 63, perQ: 40 },
            { id: 'keiji', name: '刑事', points: 63, perQ: 40 }
          ],
          rule: { type: 'oral60', line: 119, label: '合格点 119（民事・刑事の合計）' },
          facts: [
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
          lead: '4科目のマークシート。年2回のどちらかに受かればよく、合格すると2年間は短答が免除される。',
          sections: [
            { id: 'kigyo', name: '企業法', points: 100, perQ: 150 },
            { id: 'kanri', name: '管理会計論', points: 100, perQ: 250 },
            { id: 'kansa', name: '監査論', points: 100, perQ: 150 },
            { id: 'zaimu', name: '財務会計論', points: 200, perQ: 255 }
          ],
          rule: { type: 'ratio', line: 0.70, floor: 0.40, label: '総点数の70%基準・40%未満の科目があると不合格になりうる' },
          facts: [
            '時間（令和8年〜）：企業法50分・管理会計論75分・監査論50分・財務会計論150分。計500点',
            '問題数の目安：企業法20問・監査論20問・管理会計論18問（理論8・計算10）・財務会計論35問程度',
            '令和9年試験（2026年12月の第Ⅰ回短答〜）から、財務会計論・管理会計論・監査論で英語による出題がある',
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
          facts: [
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
            { id: 'gozen', name: '午前の部（択一）', points: 105, perQ: 200 },
            { id: 'gogo', name: '午後の部（択一）', points: 105, perQ: 100 },
            { id: 'kijutsu', name: '記述式', points: 140, perQ: 900 }
          ],
          rule: {
            type: 'parts',
            parts: [{ sec: 'gozen', line: 78, of: 105 }, { sec: 'gogo', line: 72, of: 105 }, { sec: 'kijutsu', line: 70, of: 140 }],
            total: { line: 255, of: 350 },
            label: '基準点 78・72・70 ＋ 合格点 255 / 350（令和7年）'
          },
          facts: [
            '午前の部 2時間：憲法3・民法20・刑法3・商法（会社法）9。1問3点で105点',
            '午後の部 3時間：択一35問（民訴5・民事執行1・民事保全1・司法書士法1・供託法3・不動産登記法16・商業登記法8）105点と、記述式2問（不動産登記・商業登記）140点',
            '合否：午前択一・午後択一・記述の各基準点に届き、かつ合計が合格点以上。令和7年は基準点78・72・70、合格点255',
            '筆記に合格して口述で不合格になった場合、申請すれば次回の筆記試験が免除される'
          ]
        },
        {
          id: 'koujutsu', name: '口述試験', kind: 'oral', when: '10月',
          lead: '筆記合格者が対象。不動産登記法・商業登記法・司法書士法について口頭で問われる。',
          sections: [{ id: 'koujutsu', name: '口述', points: 100, perQ: 40 }],
          rule: { type: 'ratio', line: 0.6, label: '本アプリは6割以上で合格（実際の基準は非公表で、ほぼ全員が合格する）' },
          facts: [
            '筆記試験の合格者に対して実施',
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
          lead: '60問・3時間30分の5肢択一。合計点と科目別の基準点の両方を満たす必要がある。',
          sections: [
            { id: 'tokkyo', name: '特許・実用新案', points: 20, perQ: 210 },
            { id: 'isho', name: '意匠', points: 10, perQ: 210 },
            { id: 'shohyo', name: '商標', points: 10, perQ: 210 },
            { id: 'joyaku', name: '条約', points: 10, perQ: 210 },
            { id: 'chosaku', name: '著作権法・不正競争防止法', points: 10, perQ: 210 }
          ],
          rule: { type: 'ratio', lineAbs: 39, of: 60, floor: 0.40, label: '合格点 39 / 60・各科目40%以上（令和7年）' },
          facts: [
            '60問・3時間30分：特許・実用新案20、意匠10、商標10、条約10、著作権法・不正競争防止法10',
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
          facts: [
            '必須科目：特許・実用新案（2時間）・意匠（1時間30分）・商標（1時間30分）',
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
          facts: [
            '3科目を面接方式で実施',
            '合否：A・B・Cのゾーン評価で、C評価が2科目以上ないこと',
            '本アプリは正答率80%以上をA、50%以上をB、それ未満をCとする'
          ]
        }
      ]
    }
  ];
})();
