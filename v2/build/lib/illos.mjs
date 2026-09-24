// Ілюстрації розділів уроків (патерн DOU: авторська ілюстрація біля кожного смислового блоку).
// Стиль: лінія var(--brand), заливка-акцент var(--brand-soft) для 1-3 площин, без інших
// кольорів/градієнтів/фільтрів/тіней/тексту. viewBox 320x220, читабельно при ширині ~260px.

export const SECTION_ILLOS = {
  'urok-01': {
    'Що це': {
      svg: `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M15,148 Q160,140 305,148"/>
<path d="M20,156 Q160,149 300,156"/>
<line x1="35" y1="152" x2="30" y2="206"/>
<line x1="285" y1="152" x2="292" y2="206"/>
<line x1="180" y1="140" x2="180" y2="128"/>
<line x1="165" y1="141" x2="195" y2="141"/>
<rect x="140" y="68" width="90" height="62" rx="5"/>
<rect x="146" y="74" width="78" height="50" rx="2" fill="var(--brand-soft)"/>
<rect x="158" y="84" width="54" height="34" rx="3"/>
<circle cx="170" cy="96" r="6"/>
<line x1="180" y1="92" x2="205" y2="92" stroke-width="1.5"/>
<line x1="180" y1="99" x2="203" y2="99" stroke-width="1.5"/>
<line x1="180" y1="106" x2="198" y2="106" stroke-width="1.5"/>
<circle cx="258" cy="38" r="13"/>
<line x1="258" y1="38" x2="258" y2="29" stroke-width="1.6"/>
<line x1="258" y1="38" x2="266" y2="42" stroke-width="1.6"/>
<circle cx="290" cy="62" r="10"/>
<circle cx="286" cy="59" r="1.2" fill="var(--brand)"/>
<circle cx="294" cy="59" r="1.2" fill="var(--brand)"/>
<path d="M285,65 Q290,69 295,65" stroke-width="1.6"/>
<path d="M60,88 Q78,84 96,88 L102,150 L54,150 Z" fill="var(--brand-soft)"/>
<circle cx="78" cy="72" r="15"/>
<circle cx="73" cy="70" r="1.3" fill="var(--brand)"/>
<circle cx="83" cy="70" r="1.3" fill="var(--brand)"/>
<path d="M63,64 Q78,44 93,64" stroke-width="2.4"/>
<circle cx="63" cy="66" r="6"/>
<circle cx="93" cy="66" r="6"/>
<path d="M60,92 Q45,115 55,145"/>
<path d="M96,92 Q112,110 130,142"/>
<circle cx="55" cy="146" r="3"/>
<circle cx="131" cy="142" r="3"/>
<circle cx="225" cy="185" r="9"/>
<circle cx="270" cy="170" r="9"/>
<path d="M232,180 Q247,160 263,175" stroke-width="3"/>
<path d="M280,158 Q292,150 285,138" stroke-width="2.8"/>
<rect x="105" y="150" width="40" height="14" rx="2"/>
<line x1="112" y1="154" x2="118" y2="154" stroke-width="1.4"/>
<line x1="122" y1="154" x2="128" y2="154" stroke-width="1.4"/>
<line x1="132" y1="154" x2="138" y2="154" stroke-width="1.4"/>
<ellipse cx="155" cy="157" rx="6" ry="9"/>
</svg>`,
      caption: "Менеджер бачить картку клієнта раніше, ніж каже перше слово.",
    },
    'Чому це працює': {
      svg: `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<rect x="149" y="28" width="12" height="14" rx="3"/>
<line x1="120" y1="55" x2="108" y2="45" stroke-width="2"/>
<line x1="190" y1="55" x2="202" y2="45" stroke-width="2"/>
<circle cx="155" cy="95" r="55"/>
<line x1="210" y1="95" x2="203" y2="95" stroke-width="1.4"/>
<line x1="195" y1="134" x2="189" y2="129" stroke-width="1.4"/>
<line x1="155" y1="150" x2="155" y2="143" stroke-width="1.4"/>
<line x1="116" y1="134" x2="121" y2="129" stroke-width="1.4"/>
<line x1="100" y1="95" x2="107" y2="95" stroke-width="1.4"/>
<line x1="116" y1="56" x2="121" y2="61" stroke-width="1.4"/>
<line x1="155" y1="40" x2="155" y2="47" stroke-width="1.4"/>
<line x1="195" y1="56" x2="189" y2="61" stroke-width="1.4"/>
<line x1="155" y1="95" x2="155" y2="45"/>
<line x1="155" y1="95" x2="172" y2="60"/>
<path d="M155,95 L155,45 A50,50 0 0 1 172,60 Z" fill="var(--brand-soft)"/>
<circle cx="196" cy="112" r="3" fill="var(--brand-soft)"/>
<path d="M204,104 A10,10 0 0 1 204,120" stroke-width="1.8"/>
<path d="M212,96 A18,18 0 0 1 212,128" stroke-width="1.6"/>
<path d="M220,88 A26,26 0 0 1 220,136" stroke-width="1.4"/>
<circle cx="250" cy="110" r="30"/>
<circle cx="241" cy="102" r="1.6" fill="var(--brand)"/>
<circle cx="256" cy="102" r="1.6" fill="var(--brand)"/>
<path d="M240,122 Q250,126 260,122" stroke-width="1.6"/>
<path d="M221,104 Q215,110 221,118" stroke-width="1.8"/>
<line x1="60" y1="185" x2="280" y2="185" stroke-width="1.6"/>
</svg>`,
      caption: "Клієнт вирішує довіряти голосу ще до того, як розчув сенс слів.",
    },
    'Як це звучить у житті': {
      svg: `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="60" cy="90" r="22"/>
<circle cx="53" cy="86" r="1.5" fill="var(--brand)"/>
<circle cx="67" cy="86" r="1.5" fill="var(--brand)"/>
<ellipse cx="60" cy="98" rx="4" ry="3"/>
<path d="M32,112 Q60,124 88,112"/>
<rect x="80" y="80" width="10" height="18" rx="4"/>
<path d="M38,110 Q24,122 29,142"/>
<circle cx="29" cy="144" r="4"/>
<path d="M82,110 Q97,100 102,86"/>
<circle cx="103" cy="84" r="4"/>
<line x1="40" y1="66" x2="33" y2="57" stroke-width="1.4"/>
<line x1="80" y1="66" x2="87" y2="57" stroke-width="1.4"/>
<line x1="46" y1="55" x2="41" y2="45" stroke-width="1.4"/>
<line x1="74" y1="55" x2="79" y2="45" stroke-width="1.4"/>
<circle cx="262" cy="112" r="22"/>
<circle cx="255" cy="108" r="1.5" fill="var(--brand)"/>
<circle cx="269" cy="108" r="1.5" fill="var(--brand)"/>
<path d="M252,120 Q262,128 272,120"/>
<path d="M234,134 Q262,146 290,134"/>
<rect x="234" y="100" width="10" height="18" rx="4"/>
<path d="M240,132 Q225,146 228,164"/>
<circle cx="228" cy="166" r="4"/>
<path d="M284,132 Q299,138 302,154"/>
<circle cx="302" cy="156" r="4"/>
<line x1="302" y1="156" x2="306" y2="150" stroke-width="1.6"/>
<path d="M250,74 Q255,68 262,72" stroke-width="1.4"/>
<path d="M252,66 Q257,61 264,64" stroke-width="1.4"/>
<path d="M90,88 Q175,78 234,104 L234,114 Q175,94 90,98 Z" fill="var(--brand-soft)"/>
<line x1="20" y1="180" x2="308" y2="180" stroke-width="1.6"/>
</svg>`,
      caption: "Одна впевнена фраза летить до клієнта без жодної паузи.",
    },
    'Типові помилки': {
      svg: `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M15,150 Q160,144 305,150"/>
<path d="M20,158 Q160,152 300,158"/>
<line x1="35" y1="154" x2="30" y2="205"/>
<line x1="285" y1="154" x2="292" y2="205"/>
<circle cx="70" cy="80" r="20"/>
<line x1="63" y1="82" x2="67" y2="84" stroke-width="1.6"/>
<line x1="73" y1="82" x2="77" y2="84" stroke-width="1.6"/>
<path d="M85,72 Q90,76 88,82" stroke-width="1.4"/>
<path d="M45,98 Q70,112 95,98 L98,150 L42,150 Z" fill="var(--brand-soft)"/>
<path d="M45,100 Q35,115 42,130"/>
<circle cx="41" cy="132" r="4"/>
<path d="M95,100 Q108,112 100,128"/>
<circle cx="100" cy="130" r="4"/>
<path d="M50,120 L90,116 L100,128 L94,145 L60,148 L44,136 Z" fill="var(--brand-soft)"/>
<line x1="55" y1="125" x2="85" y2="135" stroke-width="1.4"/>
<line x1="60" y1="140" x2="90" y2="122" stroke-width="1.4"/>
<line x1="52" y1="124" x2="75" y2="122" stroke-width="1.6"/>
<line x1="52" y1="132" x2="88" y2="130" stroke-width="1.6"/>
<line x1="52" y1="140" x2="80" y2="138" stroke-width="1.6"/>
<line x1="50" y1="121" x2="77" y2="125" stroke-width="1.8"/>
<circle cx="250" cy="100" r="20"/>
<circle cx="244" cy="96" r="1.5" fill="var(--brand)"/>
<circle cx="256" cy="96" r="1.5" fill="var(--brand)"/>
<path d="M242,110 Q250,106 258,110" stroke-width="1.6"/>
<path d="M255,65 Q268,60 266,74 Q264,84 254,82"/>
<path d="M258,60 Q266,56 264,66" stroke-width="1.4"/>
<path d="M225,120 Q250,132 275,120"/>
<rect x="270" y="92" width="10" height="18" rx="4"/>
</svg>`,
      caption: "Читання зі шпаргалки видає чуже ім'я і забирає впевненість голосу.",
    },
    'Практика': {
      svg: `<svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M15,160 Q160,155 305,160"/>
<path d="M20,168 Q160,163 300,168"/>
<line x1="35" y1="164" x2="30" y2="210"/>
<line x1="285" y1="164" x2="292" y2="210"/>
<rect x="108" y="108" width="104" height="52" rx="10"/>
<circle cx="138" cy="134" r="15"/>
<circle cx="133" cy="129" r="1.3" fill="var(--brand)"/>
<circle cx="143" cy="129" r="1.3" fill="var(--brand)"/>
<circle cx="138" cy="140" r="1.3" fill="var(--brand)"/>
<circle cx="190" cy="134" r="8" fill="var(--brand-soft)"/>
<path d="M126,116 Q138,105 150,116" stroke-width="1.6"/>
<path d="M120,107 Q138,92 156,107" stroke-width="1.4"/>
<line x1="40" y1="95" x2="40" y2="115"/>
<line x1="48" y1="95" x2="48" y2="115"/>
<line x1="56" y1="95" x2="56" y2="115"/>
<line x1="64" y1="95" x2="64" y2="115"/>
<line x1="36" y1="115" x2="68" y2="95"/>
<line x1="220" y1="128" x2="220" y2="140"/>
<line x1="228" y1="124" x2="228" y2="144"/>
<line x1="236" y1="118" x2="236" y2="150"/>
<line x1="244" y1="126" x2="244" y2="142"/>
<line x1="252" y1="116" x2="252" y2="152"/>
<line x1="260" y1="126" x2="260" y2="142"/>
<line x1="268" y1="118" x2="268" y2="150"/>
<line x1="276" y1="124" x2="276" y2="144"/>
<line x1="284" y1="128" x2="284" y2="140"/>
<path d="M298,120 Q307,127 298,138 Q292,131 298,120"/>
<line x1="218" y1="110" x2="196" y2="128" stroke-width="2.2"/>
<ellipse cx="224" cy="104" rx="9" ry="7"/>
</svg>`,
      caption: "П'ять спроб під запис — і чуєш свій голос вухом клієнта.",
    },
  },
};
