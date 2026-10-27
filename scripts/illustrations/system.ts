import type { Product } from '../../shared/model.js';
// Original code-drawn artwork. Shared geometry, consistent 480×360 canvas and 4px round outlines.
const C = {
  ink: '#503239',
  cream: '#fff5df',
  milk: '#eddbbd',
  coffee: '#a56e49',
  dark: '#674537',
  cherry: '#813d50',
  pink: '#d98b91',
  sage: '#92a780',
  green: '#72905b',
  gold: '#dda45b',
  orange: '#e8b16b',
  blue: '#b5c9c4',
  white: '#fffcf5',
};
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, extra = '') =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const circle = (x: number, y: number, r: number, fill: string, extra = '') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const group = (body: string, transform = '') => `<g transform="${transform}">${body}</g>`;
const line = (d: string, color = C.ink, width = 4) =>
  path(d, 'none', `stroke="${color}" stroke-width="${width}"`);
const plate = () =>
  ellipse(240, 276, 156, 33, C.cream) + ellipse(240, 272, 129, 20, C.white, 'stroke-width="2"');
const steam = (x = 200) => line(`M${x} 104q-12-14 1-29m28 29q-12-14 1-29`, C.coffee, 3);
const bean = (x = 335, y = 260) =>
  group(
    ellipse(0, 0, 12, 18, C.coffee) + line('M2-15Q-8 0 2 15', C.cream, 2),
    `translate(${x} ${y}) rotate(30)`,
  );
const leaf = (x = 120, y = 245) =>
  group(
    path('M0 0Q-26-35 5-45Q30-15 0 0', C.sage) + line('M0 0L5-34', C.green, 2),
    `translate(${x} ${y}) rotate(20)`,
  );
const cherry = (x = 333, y = 244) =>
  group(
    line('M-9 2Q-9-33 13-37M17 4Q16-22 13-37', C.green, 3) +
      circle(-9, 5, 14, C.cherry) +
      circle(18, 8, 15, C.cherry) +
      path('M13-37Q32-49 39-35Q24-27 13-37', C.sage) +
      line('M-14 0l-2 4M13 3l-2 4', C.pink, 3),
    `translate(${x} ${y})`,
  );
const strawberry = (x = 125, y = 260) =>
  group(
    path('M-23-12Q0-31 23-12Q26 3 0 29Q-26 3-23-12', C.pink) +
      path('M-19-13l11-9 8 9 9-10 11 11-18 5z', C.sage) +
      [-10, 0, 10].map((n, i) => line(`M${n} ${i % 2 ? 10 : 1}l1 3`, C.cream, 2)).join(''),
    `translate(${x} ${y}) rotate(-12)`,
  );
const citrus = (x = 330, y = 263, color = C.orange) =>
  group(
    circle(0, 0, 27, color) +
      circle(0, 0, 21, C.cream) +
      Array.from({ length: 6 }, (_, i) =>
        group(path('M0 0L3-18Q12-16 15-9Z', color, 'stroke-width="1"'), `rotate(${i * 60})`),
      ).join(''),
    `translate(${x} ${y}) rotate(15)`,
  );
const banana = (x = 115, y = 263) =>
  group(
    path('M-28-14Q-12 23 29-14Q22 24-8 20Q-30 16-28-14', C.gold) +
      line('M-22-8Q-7 18 23-9', C.cream, 4),
    `translate(${x} ${y}) rotate(-12)`,
  );
const chocolate = (x = 330, y = 255) =>
  group(
    path('M-26-22h48v45h-48z', C.dark) + line('M-10-22v45M7-22v45M-26 0h48', C.coffee, 3),
    `translate(${x} ${y}) rotate(14)`,
  );
const cinnamon = (x = 120, y = 258) =>
  group(
    path('M-23-7h50v14h-50z', C.coffee) + circle(26, 0, 7, C.gold) + line('M-21-2h40', C.gold, 2),
    `translate(${x} ${y}) rotate(-28)`,
  );
const almond = (x = 330, y = 270) =>
  group(
    path('M0-22Q25-8 1 22Q-24 7 0-22', C.gold) + line('M0-14v29', C.cream, 2),
    `translate(${x} ${y}) rotate(35)`,
  );
const oat = (x = 130, y = 253) =>
  group(
    line('M0 20L0-41', C.coffee, 3) +
      [-30, -16, -2]
        .map(
          (y) =>
            ellipse(-7, y, 6, 10, C.gold, 'transform="rotate(-30 -7 ' + y + ')"') +
            ellipse(7, y + 5, 6, 10, C.gold, 'transform="rotate(30 7 ' + (y + 5) + ')"'),
        )
        .join(''),
    `translate(${x} ${y}) rotate(-18)`,
  );
const mango = (x = 330, y = 264) =>
  group(
    path('M-24 8Q-35-25-2-29Q31-24 25 10Q10 31-10 25Z', C.orange) +
      line('M-9-18Q-25 1-8 16', C.cream, 4) +
      leaf(16, -20),
    `translate(${x} ${y}) scale(.85)`,
  );
const berry = (x = 125, y = 265) =>
  group(
    circle(-14, 4, 13, C.cherry) +
      circle(12, 7, 14, C.cherry) +
      circle(0, -12, 13, C.pink) +
      leaf(14, -14),
    `translate(${x} ${y}) scale(.8)`,
  );
const peach = (x = 330, y = 260) =>
  group(
    path('M0-20Q28-31 30 1Q27 28 0 28Q-28 28-29 3Q-29-27 0-20', C.pink) +
      line('M0-18Q15 4 0 23', C.gold, 2) +
      leaf(2, -20),
    `translate(${x} ${y}) scale(.8)`,
  );
const coconut = (x = 124, y = 260) =>
  group(
    path('M-30-4Q-29 31 2 31Q32 27 30-4Z', C.coffee) +
      ellipse(0, -5, 30, 12, C.white) +
      ellipse(0, -5, 18, 5, C.milk),
    `translate(${x} ${y})`,
  );
const egg = (x = 240, y = 225, scale = 1) =>
  group(
    path('M-38 0Q-44-26-16-27Q0-45 22-22Q51-23 44 8Q47 33 14 31Q-9 46-25 23Q-46 21-38 0', C.white) +
      circle(5, 0, 17, C.gold) +
      line('M0-10q10-5 15 5', C.cream, 3),
    `translate(${x} ${y}) scale(${scale})`,
  );
const avocado = (x = 240, y = 228) =>
  group(
    path('M-51 17Q-48-24 0-39Q45-25 51 17Q0 38-51 17', C.green) +
      path('M-39 14Q-34-14 0-26Q32-13 39 14Q0 27-39 14', C.sage) +
      [-18, 0, 18].map((x) => line(`M${x - 4} 17l9-32`, C.cream, 3)).join(''),
    `translate(${x} ${y})`,
  );
const bacon = (x = 240, y = 215) =>
  group(
    path('M-70-9q17-14 34 0t34 0t34 0t34 0v19q-17-14-34 0t-34 0t-34 0t-34 0z', C.pink) +
      line('M-64 1q15-10 30 0t30 0t30 0t30 0', C.cream, 4),
    `translate(${x} ${y})`,
  );
const foam = () =>
  path('M164 136q-7-27 20-29q2-25 28-18q13-25 35-7q25-16 38 13q26-4 28 23q20 7 8 27z', C.cream);
const art = (x = 238, y = 142) =>
  group(
    path('M0 11Q-35-10-16-16Q0-20 0-1Q0-20 16-16Q35-10 0 11', C.cream, 'stroke="none"') +
      line('M0 9l-2 12', C.cream, 3),
    `translate(${x} ${y})`,
  );
function cup(color: string, kind = 'wide', surface = color, decoration = 'art') {
  const narrow = kind === 'small',
    glass = kind === 'glass';
  const shape = path('M159 141h152l-10 85q-5 49-66 49q-62 0-67-49z', glass ? C.milk : C.cream);
  const body =
    ellipse(235, 287, 99, 15, C.cream) +
    path('M307 156h18q44 2 38 37q-5 32-55 27', C.cream) +
    path('M315 171h10q25 0 21 19q-4 15-34 15', C.white) +
    shape +
    (glass
      ? path('M166 157h138l-8 68q-2 39-60 39q-56 0-61-39z', color)
      : path('M180 215q55 22 108 0v16q-7 28-53 28q-47 0-55-28z', color, 'stroke="none"')) +
    ellipse(235, 141, 76, 22, surface) +
    (decoration === 'art'
      ? art()
      : decoration === 'dot'
        ? ellipse(235, 141, 20, 11, C.cream)
        : decoration === 'foam'
          ? ellipse(235, 137, 67, 19, C.cream)
          : '') +
    line('M180 171l4 28', C.white, 5);
  return narrow ? group(body, 'translate(49 51) scale(.78)') : body;
}
const ice = () =>
  [
    [190, 147, -12],
    [245, 165, 8],
    [218, 207, -5],
  ]
    .map(
      ([x, y, r]) =>
        `<rect x="${x}" y="${y}" width="32" height="26" rx="7" fill="${C.white}" fill-opacity=".52" stroke="${C.cream}" stroke-width="2" transform="rotate(${r} ${x + 16} ${y + 13})"/>`,
    )
    .join('');
function glass(layers: string[], cream = false, straw = true, showIce = true) {
  return (
    (straw ? line('M266 135l19-65h29', C.cherry, 8) : '') +
    path('M159 111h157l-15 166q-1 16-64 16q-63 0-65-16z', C.white) +
    layers
      .map((c, i) => {
        const y = 131 + (i * 148) / layers.length,
          h = 148 / layers.length;
        const inset = (y - 111) * 0.09;
        return path(
          `M${161 + inset} ${y}H${313 - inset}l-${h * 0.09} ${h}H${161 + inset + h * 0.09}Z`,
          c,
          'stroke="none"',
        );
      })
      .join('') +
    ellipse(237, 113, 78, 17, layers[0]) +
    (showIce ? ice() : line('M185 176q48 15 101 0m-96 52q42 14 90 0', C.cream, 3)) +
    path('M159 111h157l-15 166q-1 16-64 16q-63 0-65-16z', 'none') +
    line('M182 160l5 85', C.white, 5) +
    (cream ? foam() : '')
  );
}
function bottle(sparkling: boolean) {
  return (
    path(
      'M216 66h47v48q0 15 18 34q12 13 12 37v99q0 14-52 14q-52 0-52-14v-99q0-24 12-37q15-18 15-34z',
      C.blue,
    ) +
    path('M196 191q45 11 90 0v83q-45 15-90 0z', C.white, 'stroke="none"') +
    path('M213 62h54v18h-54z', sparkling ? C.sage : C.cream) +
    line('M210 153q-9 13-9 30', C.white, 5) +
    (sparkling
      ? [
          circle(219, 239, 7, C.blue),
          circle(251, 211, 5, C.blue),
          circle(261, 257, 9, C.blue),
        ].join('')
      : path('M240 210q-36 47 0 47q36 0 0-47', C.blue)) +
    (sparkling ? citrus(331, 269, C.gold) : leaf(337, 284))
  );
}
function drink(id: string) {
  let body = '',
    props = '';
  const cold =
    id.includes('iced') ||
    id.includes('cold-brew') ||
    id.includes('smoothie') ||
    id.includes('juice') ||
    [
      'strawberry-milk',
      'strawberry-matcha-cloud',
      'strawberry-matcha-latte',
      'mango-matcha',
      'yuzu-espresso-tonic',
    ].includes(id);
  let layers = [C.coffee, C.milk],
    topping = false;
  if (id.includes('matcha')) {
    layers = [C.green, C.milk];
    props = leaf(125, 265);
  }
  if (id.includes('strawberry')) {
    layers = id.includes('matcha') ? [C.green, C.milk, C.pink] : [C.milk, C.pink];
    props = strawberry();
    topping = id.includes('cloud');
  }
  if (id === 'mango-matcha') {
    layers = [C.green, C.milk, C.orange];
    props = mango() + leaf(123, 268);
  }
  if (id.includes('cherry')) {
    layers = [id.includes('chocolate') ? C.dark : C.coffee, C.milk, C.cherry];
    props = cherry();
  }
  if (id.includes('mocha')) {
    layers = [C.dark, C.coffee, C.milk];
    props = chocolate();
  }
  if (id === 'iced-long-black' || id === 'cold-brew') {
    layers = [C.coffee, C.dark];
    props = id === 'cold-brew' ? bean(330, 266) + bean(354, 243) : bean(126, 266);
  }
  if (id === 'coconut-cold-brew') {
    layers = [C.dark, C.milk];
    props = coconut() + leaf(337, 273);
  }
  if (id === 'salted-caramel-cold-brew') {
    layers = [C.coffee, C.gold, C.milk];
    props = cinnamon(330, 267) + circle(120, 268, 3, C.cream) + circle(132, 259, 3, C.cream);
  }
  if (id.includes('chai')) {
    layers = [C.coffee, C.milk];
    props = cinnamon() + cinnamon(142, 278);
  }
  if (id === 'fresh-orange-juice') {
    layers = [C.orange, C.gold];
    props = citrus();
  }
  if (id === 'apple-juice') {
    layers = [C.gold, C.orange];
    props = group(
      path('M0-18Q28-33 29-4Q30 28 7 28Q0 23-7 28Q-29 28-29-4Q-28-33 0-18', C.sage) +
        line('M0-18l4-17') +
        leaf(4, -22),
      'translate(332 261)',
    );
  }
  if (id === 'lemon-iced-tea') {
    layers = [C.gold, C.coffee];
    props = citrus(330, 264, C.gold);
  }
  if (id === 'peach-iced-tea') {
    layers = [C.gold, C.pink];
    props = peach();
  }
  if (id === 'mixed-berry-smoothie') {
    layers = [C.pink, C.cherry];
    props = berry() + strawberry(335, 263);
    topping = true;
  }
  if (id === 'mango-smoothie') {
    layers = [C.orange, C.gold];
    props = mango();
    topping = true;
  }
  if (id === 'banana-smoothie') {
    layers = [C.cream, C.gold];
    props = banana();
    topping = true;
  }
  if (id === 'yuzu-espresso-tonic') {
    layers = [C.dark, C.gold, C.cream];
    props = citrus(333, 262, C.gold) + bean(125, 270);
  }
  if (id.includes('water')) return bottle(id === 'sparkling-water');
  if (cold)
    body = glass(
      layers,
      topping,
      !['cold-brew', 'iced-long-black'].includes(id),
      !id.includes('smoothie'),
    );
  else {
    const cfg: Record<string, [string, string, string, string]> = {
      espresso: [C.coffee, 'small', C.coffee, ''],
      piccolo: [C.coffee, 'small', C.milk, 'art'],
      macchiato: [C.dark, 'small', C.dark, 'dot'],
      'long-black': [C.cherry, 'wide', C.dark, ''],
      'flat-white': [C.sage, 'wide', C.coffee, 'art'],
      latte: [C.coffee, 'glass', C.coffee, 'art'],
      cappuccino: [C.cherry, 'wide', C.cream, 'foam'],
      mocha: [C.dark, 'wide', C.coffee, 'art'],
      'matcha-latte': [C.sage, 'wide', C.green, 'art'],
      'coffee-chai-latte': [C.coffee, 'glass', C.milk, 'art'],
      'chai-latte': [C.gold, 'wide', C.milk, 'foam'],
      'hot-chocolate': [C.cherry, 'wide', C.dark, 'foam'],
      chocolate: [C.coffee, 'glass', C.dark, 'art'],
      'dirty-chai': [C.coffee, 'glass', C.coffee, 'art'],
      'batch-brew': [C.sage, 'wide', C.dark, ''],
      'extra-shot': [C.dark, 'small', C.dark, ''],
      'alternative-milk': [C.cream, 'glass', C.cream, ''],
      'brown-sugar-oat-latte': [C.gold, 'glass', C.coffee, 'art'],
      'pistachio-cream-latte': [C.sage, 'glass', C.green, 'foam'],
      'tiramisu-latte': [C.dark, 'glass', C.cream, 'foam'],
      'black-sesame-latte': [C.blue, 'wide', '#8c8276', 'art'],
      'cherry-chocolate': [C.cherry, 'wide', C.dark, 'art'],
      'biscoff-latte': [C.gold, 'glass', C.coffee, 'art'],
    };
    const v = cfg[id] ?? [C.coffee, 'wide', C.coffee, 'art'];
    body = cup(...(v as [string, string, string, string])) + steam(id === 'piccolo' ? 222 : 201);
    if (id === 'espresso') props = bean(328, 262);
    if (id === 'piccolo') props = bean(125, 269) + ellipse(334, 268, 16, 8, C.milk);
    if (id === 'macchiato')
      props = line('M130 225l-19 43', C.sage, 6) + ellipse(131, 220, 10, 17, C.cream);
    if (id === 'flat-white') props = bean(126, 267) + bean(345, 263);
    if (id === 'latte') props = bean(337, 273);
    if (id === 'cappuccino' || id === 'tiramisu-latte')
      body += [
        [-26, -2],
        [-11, 7],
        [5, -3],
        [24, 6],
        [15, 13],
      ]
        .map(([x, y]) => circle(235 + x, 137 + y, 2, C.coffee, 'stroke="none"'))
        .join('');
    if (id === 'hot-chocolate' || id === 'chocolate' || id === 'tiramisu-latte')
      props = chocolate(id === 'chocolate' ? 128 : 335, 265);
    if (id === 'dirty-chai') props += bean(337, 268);
    if (id === 'brown-sugar-oat-latte')
      props =
        oat() +
        group(
          path('M-13-13h27v27h-27z', C.coffee) + line('M-8-8h15', C.gold, 2),
          'translate(335 267) rotate(12)',
        );
    if (id === 'pistachio-cream-latte')
      props =
        group(
          ellipse(0, 0, 15, 22, C.cream) +
            path('M0-19Q22 0 0 20Q-20 0 0-19', C.green) +
            line('M0-14v27', C.sage, 3),
          'translate(334 264) rotate(28)',
        ) + leaf(125, 268);
    if (id === 'biscoff-latte')
      props = group(
        path('M-16-26h32v52h-32z', C.gold) +
          [-12, 0, 12].map((y) => line(`M-9 ${y}h18`, C.coffee, 2)).join(''),
        'translate(129 261) rotate(-15)',
      );
    if (id === 'black-sesame-latte')
      props = [0, 1, 2, 3, 4]
        .map((i) => ellipse(120 + (i % 3) * 10, 260 + Math.floor(i / 3) * 12, 3, 5, C.dark))
        .join('');
    if (id === 'alternative-milk') props = oat() + almond();
    if (id === 'batch-brew')
      props = group(
        path('M-25-25h50l-10 34h-30z', C.gold) +
          line('M-13-18l4 20m8-20v20m10-20l-3 20', C.cream, 2) +
          path('M-30 10h60v7h-60z', C.sage),
        'translate(128 245)',
      );
    if (id === 'extra-shot') body += line('M285 237h25m-12-12v24', C.cherry, 4);
  }
  return body + props;
}
const bread = (x = 240, y = 225) =>
  group(
    path('M-77 28V-29q-16-38 19-43q25-19 57-3q36-16 57 5q36 9 20 41v57z', C.gold) +
      path('M-63 16v-45q-7-24 15-28q21-14 46-1q29-14 48 3q24 6 15 27v44z', C.cream),
    `translate(${x} ${y})`,
  );
const mushroom = (x = 240, y = 218) =>
  group(
    path('M-8 0h16l8 27h-32z', C.milk) +
      path('M-30 0Q-25-46 0-42Q26-44 31 0Z', C.coffee) +
      line('M-19-3l7-9M0-3v-13m18 13l-7-9', C.cream, 2),
    `translate(${x} ${y})`,
  );
function croissant(variant: string) {
  let s =
    plate() +
    path(
      'M116 250Q96 205 142 171Q178 125 239 135Q308 125 344 178Q387 214 360 251L327 230Q294 198 242 200Q184 202 151 233Z',
      C.gold,
    );
  for (const [d, c] of [
    ['M146 173q30-8 42 42l-35 21q-14-29-7-63', C.orange],
    ['M179 148q35-9 42 57l-34 10q-16-32-8-67', C.gold],
    ['M215 138q25-7 49 0l-8 65-37 2z', C.orange],
    ['M267 141q34-1 38 22l-16 50-34-11z', C.gold],
    ['M308 166q30 1 32 26l-16 39-36-18z', C.orange],
  ])
    s += path(d, c);
  s += line(
    'M126 207l16-15M159 181l12 30M194 158l10 39M235 148v42M282 156l-10 39M318 187l-14 21',
    C.cream,
    3,
  );
  if (variant.includes('almond'))
    s +=
      [
        [165, 187],
        [206, 162],
        [240, 171],
        [286, 174],
        [319, 203],
      ]
        .map(([x, y]) => group(ellipse(0, 0, 5, 12, C.cream), `translate(${x} ${y}) rotate(40)`))
        .join('') + almond(350, 280);
  if (variant.includes('ham') || variant === 'breakfast-croissant')
    s +=
      path('M150 233Q240 200 330 231l-4 18q-93-23-171 8Z', C.pink) +
      path('M157 242q82-34 169-5l-19 24-50-17-53 21z', C.cream);
  if (variant === 'breakfast-croissant') s += leaf(117, 274);
  return s;
}
function roll(id: string) {
  let s = plate() + path('M124 234h234q-3 51-116 51q-114 0-118-51', C.gold);
  if (id.includes('halloumi'))
    s +=
      avocado(240, 229) +
      path('M142 201l166-13 20 32-167 17z', C.cream) +
      line('M173 201l10 23m32-27 10 22m31-26 10 22', C.coffee, 5);
  else {
    s += id.includes('sausage')
      ? path('M143 213q-13-12 2-24h184q26 12 2 31z', C.coffee) +
        line('M170 195l17 14m31-14 17 14m31-14 17 14', C.gold, 3)
      : bacon(240, 216);
    s += egg(242, 202, 0.86);
  }
  s +=
    line('M145 240q23-18 46-3t46 0t46 0t47-5', C.cherry, 6) +
    path('M123 174Q132 107 239 106Q347 106 359 174Q241 204 123 174Z', C.gold) +
    path('M141 155Q152 120 215 121', 'none', `stroke="${C.cream}" stroke-width="7"`);
  s += [
    [181, 142],
    [215, 157],
    [247, 136],
    [280, 157],
    [312, 142],
  ]
    .map(([x, y]) => line(`M${x} ${y}l4-4`, C.cream, 3))
    .join('');
  return (
    s +
    (id.includes('halloumi')
      ? leaf(121, 273)
      : id.includes('sausage')
        ? mushroom(356, 269)
        : path('M107 259l22-14 8 23z', C.cherry))
  );
}
function toastie(id: string) {
  let s =
    plate() +
    path('M123 218l154-80 92 63-157 85z', C.gold) +
    path('M131 218l148-68 79 52-149 72z', C.sage) +
    path('M134 207l140-70 79 51-142 78z', id.includes('ham') ? C.pink : C.cream);
  s +=
    path('M119 192l153-82 97 64-157 85z', C.gold) +
    path('M139 187l133-62 75 48-136 68z', C.cream) +
    line('M177 171l82 45m-51-61 81 44m-49-61 78 44', C.coffee, 6) +
    line('M272 111l-61 148', C.ink, 3);
  return (
    s +
    (id.includes('mushroom')
      ? mushroom(343, 270)
      : id.includes('ham')
        ? group(
            circle(0, 0, 27, C.cherry) +
              circle(0, 0, 21, C.pink) +
              [0, 120, 240]
                .map((r) =>
                  group(path('M0 0Q-17-24 8-15Z', C.cream, 'stroke-width="1"'), `rotate(${r})`),
                )
                .join(''),
            'translate(341 268)',
          )
        : leaf(344, 277))
  );
}
function bowl(id: string) {
  const acai = id === 'acai-bowl';
  let s =
    path('M125 196h230q-15 103-115 105q-101-5-115-105', acai ? C.sage : C.cherry) +
    ellipse(240, 196, 115, 41, C.cream) +
    ellipse(240, 195, 99, 29, acai ? C.cherry : C.white) +
    line('M155 236q10 25 30 31', C.white, 5);
  s += [0, 1, 2]
    .map(
      (i) =>
        circle(185 + i * 25, 190 - i * 6, 15, C.gold) +
        circle(185 + i * 25, 190 - i * 6, 8, C.cream) +
        circle(185 + i * 25, 190 - i * 6, 2, C.coffee),
    )
    .join('');
  s +=
    berry(291, 187) +
    [0, 1, 2, 3, 4, 5]
      .map((i) => ellipse(222 + (i % 3) * 14, 204 + Math.floor(i / 3) * 8, 5, 3, C.gold))
      .join('');
  return s + (acai ? banana(125, 281) + coconut(354, 274) : oat(130, 281) + strawberry(349, 273));
}
function cake(id: string) {
  let s = plate();
  if (id === 'chocolate-brownie')
    return (
      s +
      path('M153 177l128-21 57 42-136 29z', C.dark) +
      path('M153 177v69l49 40v-59z', C.coffee) +
      path('M202 227l136-29v66l-136 22z', C.dark) +
      line('M174 188l23 10 26-16 26 9 24-14 29 18', C.coffee, 4) +
      chocolate(363, 271)
    );
  if (id === 'banana-bread')
    return (
      s +
      group(bread(240, 225), 'translate(16 12) rotate(9 240 225)') +
      bread(222, 221) +
      [
        [-33, -18],
        [12, -36],
        [30, 9],
        [-21, 12],
      ]
        .map(([x, y]) => ellipse(222 + x, 213 + y, 6, 4, C.coffee))
        .join('') +
      banana(345, 275)
    );
  const carrot = id === 'carrot-cake';
  s +=
    path('M145 183l167-58 22 98-122 46z', carrot ? C.gold : C.cream) +
    path('M145 183v69l67 40v-23z', carrot ? C.coffee : C.milk) +
    path('M212 269l122-46v41l-122 28z', carrot ? C.gold : C.cream);
  s +=
    path('M145 183l167-58 22 36-122 65z', carrot ? C.cream : C.coffee) +
    line('M161 225l51 30 106-39', C.cream, 8);
  if (carrot)
    s +=
      group(
        path('M-18-8l38 14-30 18z', C.orange) + line('M18 6l10-10m-10 10 17 0', C.green, 4),
        'translate(248 168)',
      ) + almond(350, 279);
  else s += cherry(352, 266);
  return s;
}
function food(id: string) {
  if (id.includes('croissant')) return croissant(id);
  if (id.endsWith('roll')) return roll(id);
  if (id.includes('toastie')) return toastie(id);
  if (id === 'granola-and-greek-yoghurt' || id === 'acai-bowl') return bowl(id);
  if (['banana-bread', 'chocolate-brownie', 'carrot-cake', 'basque-cheesecake'].includes(id))
    return cake(id);
  if (id === 'avocado-toast')
    return plate() + bread() + avocado() + leaf(132, 276) + citrus(352, 270, C.gold);
  if (id === 'eggs-on-toast')
    return plate() + bread() + egg(209, 210, 0.85) + egg(272, 229, 0.8) + leaf(345, 277);
  if (id === 'smoked-salmon-bagel')
    return (
      plate() +
      ellipse(240, 229, 108, 60, C.gold) +
      path('M135 216q105-45 210 0v20q-104 32-210 0z', C.white) +
      path('M138 209q30-31 60-9t60 0t82 9l-1 21q-35-18-65 0t-65 0t-70 0z', C.pink) +
      ellipse(240, 186, 110, 48, C.gold) +
      ellipse(240, 184, 33, 16, C.cream) +
      line('M162 178l7-3m29-15 8 0m79 3 7 2m22 23 6 1', C.cream, 4) +
      leaf(348, 267)
    );
  if (id === 'chicken-pesto-panini')
    return (
      plate() +
      path('M127 220l179-67 57 50-178 78z', C.gold) +
      path('M132 211l171-64 53 45-170 77z', C.sage) +
      path('M123 190l176-72q41-7 63 39l-179 82q-43-1-60-49', C.cream) +
      line('M160 174l43 40m-4-56 44 40m-2-57 45 40m-4-57 41 37', C.coffee, 6) +
      leaf(352, 275)
    );
  if (id === 'breakfast-wrap')
    return (
      plate() +
      path('M151 153l109-36 100 131q8 22-40 48q-34 18-53 0z', C.cream) +
      ellipse(205, 140, 59, 27, C.gold, 'transform="rotate(-18 205 140)"') +
      leaf(185, 147) +
      egg(214, 136, 0.45) +
      bacon(207, 139) +
      path('M171 166l75-23 87 114-49 30z', C.milk) +
      line('M218 205l62-22m-44 49 62-22m-44 48 58-22', C.coffee, 5)
    );
  if (id === 'big-breakfast')
    return (
      plate() +
      group(bread(240, 225), 'translate(-35 3) scale(.76)') +
      egg(241, 185, 0.8) +
      egg(296, 217, 0.7) +
      bacon(240, 270) +
      mushroom(346, 224) +
      path('M300 267q0-24 31-25q32 0 33 25z', C.cherry) +
      path('M127 252q-9-13 3-21l42 7q17 11 0 23z', C.coffee)
    );
  throw new Error(`Missing original illustration recipe: ${id}`);
}
export function drawSticker(p: Product) {
  const drawing = p.categoryId === 'food' ? food(p.id) : drink(p.id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 480 360"><title>${p.name.replaceAll('&', '&amp;')} — original café sticker</title><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="2" dy="6" stdDeviation="3" flood-color="#503239" flood-opacity=".13"/></filter></defs><g stroke="${C.ink}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" filter="url(#shadow)">${drawing}</g></svg>`;
}
