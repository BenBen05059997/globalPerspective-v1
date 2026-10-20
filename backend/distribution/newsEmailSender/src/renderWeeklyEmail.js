'use strict';

const { orderedSections, LABELS } = require('./_weekly/sections');
const { storyHref, briefingHref, absoluteUrl } = require('./_shared/links');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => /^https?:\/\//i.test(value || '') ? String(value).replace(/&amp;/g,'&') : null;
const wordCount = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;

function renderWeeklyEmail(week, {siteUrl, unsubUrl} = {}) {
  const lines = [], rows = [];
  const link = (text, href) => href ? `<a href="${esc(href)}" style="color:#202020;text-decoration:underline">${esc(text)}</a>` : esc(text);
  function block(text, html) { return {text, html:html || `<p style="margin:0 0 12px">${esc(text)}</p>`}; }
  function judgment(j) {const tag=`${LABELS.judgment} · ${String(j.confidence).toUpperCase()}`;return block(`${tag}: ${j.text}`,`<p style="margin:0 0 12px"><span style="font-size:10px;letter-spacing:.5px;font-weight:700">${esc(tag)}</span><br>${esc(j.text)}</p>`);}
  function fact(f) {
    const sources=f.sources || [];
    const refs=sources.map(s=>link(s.outlet,safeUrl(s.url))).join(' · ');
    return block(`${LABELS.fact}: ${f.text}\n${sources.map(s=>`${s.outlet}${safeUrl(s.url)?`: ${safeUrl(s.url)}`:''}`).join(' · ')}`,
      `<p style="margin:0 0 12px"><span style="font-size:10px;letter-spacing:.5px;font-weight:700">${LABELS.fact}</span><br>${esc(f.text)}<br><span style="font-size:11px">${refs}</span></p>`);
  }
  function title(item) {const url=absoluteUrl(storyHref(item.threadId),siteUrl);return block(`${item.title}\n${url}`,`<p style="margin:16px 0 8px;font-weight:700">${link(item.title,url)}</p>`);}
  function content(key, items) {
    const out=[];
    for(const item of items) {
      if(key==='lead') {
        out.push(title({title:item.headline,threadId:item.threadId}),fact(item.happened),judgment(item.argument),judgment(item.expect),
          block(`JUDGMENT · ${item.expect.confidence.toUpperCase()} · Would prove us wrong by ${item.wouldProveWrong.by}: ${item.wouldProveWrong.condition}`));
      } else if(key==='moved') {
        out.push(title(item),judgment(item.mechanism));
        if(item.kind==='score')out.push(block(`Risk ${item.scoreFrom} → ${item.scoreTo}`));
      } else if(key==='trace') {
        out.push(title(item),block(`Risk ${item.risk.score} · ${item.risk.tier}`));
        for(const step of item.steps)out.push(block(step.date),fact(step.fact));
        for(const branch of item.branches)out.push(block(`JUDGMENT · ${Math.round(branch.p*100)}% · ${branch.text.replace(/\.+$/, '')}. ${branch.trigger===branch.text?'':`Trigger: ${branch.trigger.replace(/\.+$/, '')}. `}By ${branch.by}. ${branch.status==='not_checked'?'Not yet checked':branch.status}.`));
      } else if(key==='dates') {
        const url=item.threadId?absoluteUrl(storyHref(item.threadId),siteUrl):null;
        const deadline=item.kind==='forecast_due'?'Forecast deadline':'Logged trigger deadline';
        out.push(block(`FACT · ${deadline} ${item.date}: Check whether ${item.what}${url?`\n${url}`:''}`,`<p style="margin:0 0 12px"><span style="font-size:10px;font-weight:700">FACT · ${esc(deadline)} ${esc(item.date)}</span><br>Check whether ${link(item.what,url)}</p>`));
      } else if(key==='new') {
        out.push(title(item),block(`First seen ${item.firstSeen} · ${item.outlets.length} outlets`),fact(item.fact),judgment(item.firstRead));
        for(const edge of item.connectsTo.slice(0,1)) {
          const url=absoluteUrl(storyHref(edge.threadId),siteUrl);
          out.push(block(`JUDGMENT · LOW · Possibly related: ${edge.threadId}\n${url}`,`<p style="margin:0 0 12px;font-size:11px">JUDGMENT · LOW · Possibly related: ${link('story',url)}</p>`));
        }
      } else if(key==='coverage') {
        const text=`FACT · ${item.stories} stories · ${item.entries} entries · ${item.outlets} outlets. ${item.analysedNew.analysed} of ${item.analysedNew.total} new stories analysed. Missing archive days: ${item.missingDays.join(', ') || 'none'}. Corrections: ${item.corrections.join('; ') || 'none recorded'}.`;
        out.push(block(text),block(item.note));
      }
    }
    return out;
  }
  for(const {section,items} of orderedSections(week)) {
    const groups=items.length?items.map(item=>content(section.key,[item])):[[block(section.emptyText)]];
    // Keep complete story groups whenever possible. A long lead/coverage may use a
    // prefix of complete blocks, but no fact or judgment is cut mid-sentence.
    let used=0,omitted=false;const kept=[];
    for(const group of groups) {
      const size=group.reduce((n,b)=>n+wordCount(b.text),0);
      if(used+size<=section.emailWordCap){kept.push(...group);used+=size;}
      else if(section.single){
        for(const b of group){const n=wordCount(b.text);if(used+n<=section.emailWordCap){kept.push(b);used+=n;}else omitted=true;}
      }else {omitted=true;break;}
    }
    if(omitted)kept.push(block('More detail is available through the story links.'));
    lines.push(section.title,...kept.map(b=>b.text),'');
    rows.push(`<tr data-section="${esc(section.key)}"><td style="padding:20px 28px;border-top:1px solid #deded9"><h2 style="font:700 17px/1.35 Georgia,serif;margin:0 0 14px">${esc(section.title)}</h2>${kept.map(b=>b.html).join('')}</td></tr>`);
  }
  const weeklyUrl=absoluteUrl(briefingHref({mode:'weekly',week:week.weekEnding}),siteUrl);
  const footer=`The link never signs you in. ${unsubUrl?`Unsubscribe: ${unsubUrl}`:'Unsubscribe through your email preferences in your account.'}`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The analyst's weekly</title></head><body style="margin:0;background:#f5f5f1;color:#202020;font:14px/1.6 -apple-system,BlinkMacSystemFont,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff"><tr><td style="padding:28px"><p style="font-size:11px;letter-spacing:1px">GLOBAL PERSPECTIVES</p><h1 style="font:700 28px/1.2 Georgia,serif">The analyst's weekly</h1><p>Week ending ${esc(week.weekEnding)}</p></td></tr>${rows.join('')}<tr><td style="padding:24px 28px;border-top:1px solid #deded9;font-size:11px">${link('Read the weekly',weeklyUrl)}<p>The link never signs you in.</p>${unsubUrl?link('Unsubscribe',safeUrl(unsubUrl)):'Unsubscribe through your email preferences in your account.'}</td></tr></table></td></tr></table></body></html>`;
  return {subject:`The analyst's weekly — ${week.weekEnding}`,html,text:`Global Perspectives\nThe analyst's weekly — week ending ${week.weekEnding}\n\n${lines.join('\n')}\nRead the weekly: ${weeklyUrl}\n${footer}`};
}
module.exports={renderWeeklyEmail};
