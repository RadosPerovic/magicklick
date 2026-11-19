import type { OrderEmailSnapshot } from "./order-snapshot";
import type { SmtpConfig } from "./smtp-config.server";

export type EmailKind = "customer" | "internal";

const contactEmail = "info@magic-klick.rs";
const contactPhone = { number: "+381653613281", display: "+381 65 361 3281" };
const money = (value: number) => `${new Intl.NumberFormat("sr-RS").format(value)} RSD`;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function orderMessage(order: OrderEmailSnapshot, kind: EmailKind, config: SmtpConfig) {
  const internal = kind === "internal";
  const subject = `${internal ? "Nova porudžbina" : "Potvrda porudžbine"} #${order.id}`;
  const date = new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Belgrade" }).format(new Date(order.createdAt));
  const intro = internal ? "Primljena je nova porudžbina za obradu i isporuku." : "Hvala na porudžbini! U nastavku je pregled Vaše porudžbine.";
  const delivery = order.deliveryMethod === "post-office" ? "Post Express — preuzimanje u pošti" : "Post Express — na adresu";
  const details = [
    ["Ime i prezime", order.customer.name], ["Telefon", order.customer.phone], ["Email", order.customer.email],
    ["Način isporuke", delivery],
    ...(order.deliveryMethod === "courier" ? [["Mesto", order.customer.city], ["Ulica i broj", order.customer.address]] : []),
    ["Poštanski broj", order.customer.postalCode], ["Napomena", order.customer.note || "Nema napomene."],
  ];
  const text = [subject, intro, `Broj porudžbine: ${order.id}`, `Datum: ${date}`, "", "STAVKE",
    ...order.lines.map(line => `${line.name} × ${line.quantity} | Cena po komadu: ${money(line.unitPrice)} | Iznos: ${money(line.total)}`),
    "", `Proizvodi ukupno: ${money(order.subtotal)}`, `Dostava: ${order.shipping === 0 ? "Besplatno" : money(order.shipping)}`,
    `UKUPNO: ${money(order.total)}`, "", internal ? "PODACI KUPCA ZA OBRADU I ISPORUKU" : "PODACI ZA ISPORUKU",
    ...details.map(([label, value]) => `${label}: ${value}`), "", "Plaćanje pouzećem. Ova poruka potvrđuje prijem porudžbine.",
    "", "Srdačan pozdrav,", `Vaš ${config.fromName}`, "",
    `Za sve informacije i pitanja pišite nam na ${contactEmail} ili nas pozovite na ${contactPhone.display}.`,
    "Sajt: https://magic-klick.rs",
    "Instagram: @magic.klick — https://www.instagram.com/magic.klick/",
  ].join("\n");
  const html = `<!doctype html><html lang="sr-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@media(max-width:480px){.email-content{padding:24px 16px!important}.email-brand{padding:22px 16px!important}.email-footer{padding:24px 16px!important}.email-title{font-size:24px!important}.email-items{font-size:13px!important}.email-items th,.email-items td{padding-left:4px!important;padding-right:4px!important}}</style></head>
<body style="margin:0;padding:28px 12px;background:#f4f4f6;color:#242428;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#fff;border:1px solid #e4e4e8;border-radius:12px;overflow:hidden">
<tr><td class="email-brand" style="padding:24px 28px;background:#19191c;border-top:4px solid #781e32;color:#fff;font-size:25px;font-weight:bold;letter-spacing:-0.5px">${escape(config.fromName)}</td></tr>
<tr><td class="email-content" style="padding:30px 28px">
<h1 class="email-title" style="font-size:28px;line-height:1.25;letter-spacing:-0.6px;margin:0 0 14px;color:#242428">${internal ? "Nova porudžbina" : "Potvrda porudžbine"}</h1>
<p style="margin:0 0 24px;color:#606068">${escape(intro)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f7f9;border:1px solid #ececf0;border-radius:8px"><tr><td style="padding:15px 16px;font-size:14px;line-height:1.8">
<span style="color:#73737b">Broj porudžbine</span><br><strong style="color:#781e32;overflow-wrap:anywhere;word-break:break-all">${escape(order.id)}</strong><br>
<span style="color:#73737b">Datum:</span> ${escape(date)}</td></tr></table>
<table class="email-items" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5">
<caption style="text-align:left;font-weight:bold;font-size:18px;color:#242428;padding:26px 0 12px">Stavke porudžbine</caption>
<thead><tr style="background:#f7f7f9;color:#66666e"><th scope="col" style="padding:10px 8px;text-align:left;font-weight:normal;border-bottom:1px solid #e9e9ee">Proizvod</th><th scope="col" style="padding:10px 8px;text-align:center;font-weight:normal;border-bottom:1px solid #e9e9ee">Kol.</th><th scope="col" style="padding:10px 8px;text-align:right;font-weight:normal;border-bottom:1px solid #e9e9ee">Cena</th><th scope="col" style="padding:10px 8px;text-align:right;font-weight:normal;border-bottom:1px solid #e9e9ee">Iznos</th></tr></thead><tbody>
${order.lines.map(line => `<tr><td style="padding:14px 8px;border-bottom:1px solid #ededf1;vertical-align:top;font-weight:bold">${escape(line.name)}</td><td style="padding:14px 8px;text-align:center;vertical-align:top;border-bottom:1px solid #ededf1;color:#606068">${line.quantity}</td><td style="padding:14px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #ededf1;white-space:nowrap;color:#606068">${money(line.unitPrice)}</td><td style="padding:14px 8px;text-align:right;vertical-align:top;border-bottom:1px solid #ededf1;white-space:nowrap;font-weight:bold">${money(line.total)}</td></tr>`).join("")}
</tbody></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;margin-top:14px"><tr><td style="padding:5px 0;color:#73737b">Proizvodi ukupno</td><td align="right" style="padding:5px 0;font-weight:bold">${money(order.subtotal)}</td></tr><tr><td style="padding:5px 0;color:#73737b">Dostava</td><td align="right" style="padding:5px 0;font-weight:bold">${order.shipping === 0 ? "Besplatno" : money(order.shipping)}</td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;background:#f6eef0;border:1px solid #ead9de;border-radius:8px;color:#781e32"><tr><td style="padding:15px 16px;font-weight:bold">Ukupno</td><td align="right" style="padding:15px 16px;font-size:23px;font-weight:bold;white-space:nowrap">${money(order.total)}</td></tr></table>
<h2 style="font-size:18px;line-height:1.4;margin:28px 0 12px;color:#242428">${internal ? "Kupac i isporuka" : "Podaci za isporuku"}</h2>
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-collapse:collapse;font-size:14px;line-height:1.6">
${details.map(([label, value]) => `<tr><th scope="row" width="35%" style="padding:9px 12px 9px 0;text-align:left;vertical-align:top;border-bottom:1px solid #f0f0f3;color:#73737b;font-weight:normal">${escape(label)}</th><td style="padding:9px 0;vertical-align:top;border-bottom:1px solid #f0f0f3;overflow-wrap:anywhere;word-break:break-word">${escape(value).replace(/\n/g, "<br>")}</td></tr>`).join("")}
</table>
<p style="margin:22px 0 0;font-size:13px;color:#73737b">Plaćanje pouzećem. Ova poruka potvrđuje prijem porudžbine.</p>
</td></tr>
<tr><td class="email-footer" style="padding:24px 28px;background:#f7f7f9;border-top:1px solid #e9e9ee;overflow-wrap:anywhere">
<p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#606068">Srdačan pozdrav,<br><strong style="color:#781e32">Vaš ${escape(config.fromName)}</strong></p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#73737b">Za sve informacije i pitanja pišite nam na <a href="mailto:${contactEmail}" style="color:#781e32;text-decoration:underline">${contactEmail}</a> ili nas pozovite na <a href="tel:${contactPhone.number}" style="color:#781e32;text-decoration:underline;white-space:nowrap">${contactPhone.display}</a>.</p>
<p style="margin:0;font-size:14px"><a href="https://magic-klick.rs" style="color:#781e32;font-weight:bold;text-decoration:underline">magic-klick.rs</a></p>
<p style="margin:8px 0 0;font-size:14px"><a href="https://www.instagram.com/magic.klick/" style="color:#781e32;text-decoration:underline">Instagram: @magic.klick</a></p>
</td></tr></table></td></tr></table></body></html>`;
  return {
    from: { name: config.fromName, address: config.fromEmail },
    to: internal ? config.ordersEmail : order.customer.email,
    replyTo: config.fromEmail, subject, text, html,
    date: new Date(order.createdAt),
    messageId: `<${order.id}.${kind}@${config.fromEmail.split("@")[1]}>`,
    disableFileAccess: true, disableUrlAccess: true,
  };
}
