import React from 'react';
import {
  SIGNERS, AGENCY, buildClauses, money, longDate
} from './contract-model.js';

/* ============================================================
   The agreement, rendered for screen and for print.
   Used by /contract (preview) and /sign (what the client reads).
   Wording comes from contract-model.js so there is only one copy.
   ============================================================ */

/** Renders the **bold** convention used by the clause strings. */
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}

function Paragraphs({ paras }) {
  const out = [];
  let bullets = [];

  const flush = (key) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${key}`} className="my-1.5 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}
      </ul>
    );
    bullets = [];
  };

  paras.forEach((p, i) => {
    if (p.startsWith('- ')) {
      bullets.push(p.slice(2));
    } else {
      flush(i);
      out.push(<p key={`p-${i}`} className="my-1.5"><Rich text={p} /></p>);
    }
  });
  flush('end');
  return <>{out}</>;
}

function SignatureSlot({ image, attestName, placeholder }) {
  if (image) {
    return <img src={image} alt="Signature" className="max-h-[58px] object-contain object-left" />;
  }
  if (attestName) {
    return (
      <span className="font-[cursive] text-[19pt] leading-none text-black" style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}>
        {attestName}
      </span>
    );
  }
  return <span className="text-[8pt] italic text-[#999]">{placeholder}</span>;
}

export default function ContractDocument({
  d,
  tlmSignature = '',
  tlmAttest = false,
  clientSignature = '',
  clientSignedAt = '',
  reference = ''
}) {
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];
  const clauses = buildClauses(d);
  const agreementDate = longDate(d.agreementDate);
  const setupFee = money(d.setupFee, d.currency);
  const monthlyFee = money(d.monthlyFee, d.currency);

  return (
    <article className="contract-sheet bg-white text-black">
      {/* Letterhead */}
      <header className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <img src={AGENCY.mark} alt="" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-[13pt] font-extrabold leading-none tracking-tight">{AGENCY.name}</div>
            <div className="mt-1 text-[7.5pt] font-bold uppercase tracking-[0.22em] text-[#0F59F5]">
              Marketing for Contractors
            </div>
          </div>
        </div>
        <div className="text-right text-[8pt] leading-[1.5] text-[#333]">
          <div>{AGENCY.site}</div>
          <div>{AGENCY.email}</div>
          <div>{AGENCY.phone}</div>
        </div>
      </header>

      <h1 className="text-center text-[16pt] font-extrabold tracking-tight">Marketing Services Agreement</h1>
      <p className="mb-6 mt-1 text-center text-[9pt] text-[#555]">
        {agreementDate ? `Dated ${agreementDate}` : 'Dated ________________'}
        {reference ? ` · Ref ${reference}` : ''}
      </p>

      {/* Terms at a glance — the numbers people actually check */}
      <table className="mb-6 w-full border-collapse border border-[#ddd] text-[9.5pt]">
        <tbody>
          <tr className="border-b border-[#ddd]">
            <td className="w-[170px] bg-[#f7f7f7] p-2 align-top font-bold">Client</td>
            <td className="p-2">
              <strong>{d.clientBusiness || '________________'}</strong>
              {d.clientContact ? <> — {d.clientContact}{d.clientTitle ? `, ${d.clientTitle}` : ''}</> : null}
              {(d.clientEmail || d.clientPhone) && (
                <div className="text-[#555]">{[d.clientEmail, d.clientPhone].filter(Boolean).join(' · ')}</div>
              )}
            </td>
          </tr>
          <tr className="border-b border-[#ddd]">
            <td className="bg-[#f7f7f7] p-2 align-top font-bold">Initial setup fee</td>
            <td className="p-2"><strong>{setupFee || '________________'}</strong> <span className="text-[#555]">one time, before setup begins</span></td>
          </tr>
          <tr className="border-b border-[#ddd]">
            <td className="bg-[#f7f7f7] p-2 align-top font-bold">Monthly service fee</td>
            <td className="p-2">
              <strong>{monthlyFee ? `${monthlyFee} per month` : '________________'}</strong>{' '}
              <span className="text-[#555]">starting on the setup completion date</span>
            </td>
          </tr>
          <tr>
            <td className="bg-[#f7f7f7] p-2 align-top font-bold">Term</td>
            <td className="p-2"><strong>{d.term}</strong></td>
          </tr>
        </tbody>
      </table>

      {/* Clauses */}
      {clauses.map((c) => (
        <section key={c.n} className="contract-clause mb-4">
          <h2 className="mb-1 text-[11.5pt] font-bold text-black">{c.n}. {c.title}</h2>
          <div className="text-[10pt] leading-[1.55] text-black">
            <Paragraphs paras={c.paras} />
          </div>
        </section>
      ))}

      {/* Signatures */}
      <section className="contract-signatures mt-8 border-t-2 border-black pt-5">
        <p className="mb-5 text-[9.5pt]">
          The parties agree to the terms above and have signed on the dates shown.
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="mb-2 text-[8pt] font-bold uppercase tracking-[0.15em] text-[#555]">
              For {AGENCY.name}
            </div>
            <div className="flex h-[62px] items-end">
              <SignatureSlot
                image={tlmSignature}
                attestName={tlmAttest ? signer.name : ''}
                placeholder="(signature)"
              />
            </div>
            <div className="border-b border-black" />
            <div className="mt-1.5 text-[9.5pt] font-bold">{signer.name}</div>
            <div className="text-[8.5pt] text-[#555]">{signer.title}</div>
            <div className="mt-4">
              <div className="text-[9.5pt]">{agreementDate || ' '}</div>
              <div className="mt-0.5 border-b border-black" />
              <div className="mt-1 text-[8pt] uppercase tracking-wider text-[#555]">Date</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[8pt] font-bold uppercase tracking-[0.15em] text-[#555]">
              For {d.clientBusiness || 'the Client'}
            </div>
            <div className="flex h-[62px] items-end">
              <SignatureSlot image={clientSignature} placeholder="(signature)" />
            </div>
            <div className="border-b border-black" />
            <div className="mt-1.5 text-[9.5pt] font-bold">
              {d.clientContact || <span className="italic text-[#999]">Print name</span>}
            </div>
            <div className="text-[8.5pt] text-[#555]">
              {d.clientTitle || 'Title'}{d.clientBusiness ? `, ${d.clientBusiness}` : ''}
            </div>
            <div className="mt-4">
              <div className="text-[9.5pt]">{clientSignedAt || ' '}</div>
              <div className="mt-0.5 border-b border-black" />
              <div className="mt-1 text-[8pt] uppercase tracking-wider text-[#555]">Date</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex justify-between border-t border-[#ddd] pt-3 text-[7.5pt] text-[#777]">
        <span>{AGENCY.name} — Marketing Services Agreement</span>
        <span>{d.clientBusiness || 'Client'}{agreementDate ? ` · ${agreementDate}` : ''}</span>
      </footer>
    </article>
  );
}
