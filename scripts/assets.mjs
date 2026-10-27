import { writeFileSync } from 'node:fs';
const specs = [
  ['coffee', '#dfcfbb', '#a76d43'],
  ['matcha', '#dbe0ca', '#6e8051'],
  ['cold-brew', '#d4bca2', '#533729'],
];
for (const [name, bg, drink] of specs) {
  writeFileSync(
    `public/images/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 440"><rect width="600" height="440" fill="${bg}"/><path d="M0 350 Q220 310 600 370 V440 H0" fill="#ffffff" opacity=".16"/><ellipse cx="309" cy="353" rx="132" ry="27" fill="#432819" opacity=".13"/><ellipse cx="290" cy="324" rx="143" ry="37" fill="#f0e7da"/><path d="M392 161 C485 139 488 282 395 271" fill="none" stroke="#f9f3e8" stroke-width="24"/><path d="M181 146 H407 L389 283 Q376 329 295 329 Q214 329 201 283Z" fill="#fcf6eb"/><ellipse cx="294" cy="147" rx="113" ry="42" fill="#fdf8ef"/><ellipse cx="294" cy="149" rx="99" ry="32" fill="${drink}"/><path d="M293 172 C205 138 257 118 294 147 C327 116 378 139 293 172" fill="#eee1bf"/><path d="M294 171 L295 139" stroke="#eee1bf" stroke-width="5"/><text x="293" y="264" text-anchor="middle" font-family="Georgia,serif" font-size="19" fill="#582330">black cherry</text><path d="M253 72 Q236 43 262 21 M311 82 Q333 55 310 30" fill="none" stroke="#fff" stroke-width="5" opacity=".45"/></svg>`,
  );
}
writeFileSync(
  'public/images/food.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 440"><rect width="600" height="440" fill="#e2d4bc"/><path d="M70 0L480 440M145 0L555 440" stroke="#b6a488" stroke-width="2" opacity=".25"/><ellipse cx="300" cy="294" rx="198" ry="102" fill="#c4b394"/><ellipse cx="300" cy="270" rx="198" ry="102" fill="#faf4e8"/><path d="M150 250 Q163 157 238 154 Q244 205 283 212 Q316 180 339 143 Q434 168 449 246 Q391 311 319 282 Q239 330 150 250Z" fill="#bd7a3f"/><path d="M172 244 Q173 190 221 177 L260 270 M259 217 L286 286 M318 218 L340 269 M357 171 Q409 190 423 239" fill="none" stroke="#e9b874" stroke-width="22"/><path d="M464 101l30 135M478 96l31 135" stroke="#78634c" stroke-width="7"/></svg>`,
);
