#!/usr/bin/env node
/**
 * Deterministic strategy specification gate.
 *
 * This checker is deliberately read-only. It validates whether a strategy idea
 * is specified enough for research/paper review, not whether it should trade.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const HUMAN_CONFIRMATION_RE = /human|manual|confirm|approval|hitl|人間|手動|確認|承認/i;
const PLACEHOLDER_RE = /(?:YYYY\s*[-/]\s*MM\s*[-/]\s*DD|define\b|as\s+applicable|tbd|todo|placeholder|fill\s+in|to\s+be\s+determined|your\s+(?:value|rule|condition|assumption)|example\s+(?:value|rule|condition|assumption))/i;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_RANGE_RE = /^\s*(\d{4}-\d{2}-\d{2})\s*(?:\.\.|to)\s*(\d{4}-\d{2}-\d{2})\s*$/i;

function textValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
}

function hasConcreteValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0 && !PLACEHOLDER_RE.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasConcreteValue);
  if (typeof value === 'object') return Object.values(value).some(hasConcreteValue);
  return false;
}

function hasText(value, pattern) {
  return textValues(value).some(text => {
    if (PLACEHOLDER_RE.test(text)) return false;
    return typeof pattern === 'function' ? pattern(text) : pattern.test(text);
  });
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(ISO_DATE_RE);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return { iso: `${year}-${month}-${day}`, time: date.getTime() };
}

export function parseISODateRange(value) {
  let start;
  let end;
  if (typeof value === 'string') {
    const match = value.match(ISO_RANGE_RE);
    if (!match) return null;
    [, start, end] = match;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    start = value.start ?? value.from;
    end = value.end ?? value.to;
  } else {
    return null;
  }
  const parsedStart = parseISODate(start);
  const parsedEnd = parseISODate(end);
  if (!parsedStart || !parsedEnd || parsedStart.time > parsedEnd.time) return null;
  return { start: parsedStart.iso, end: parsedEnd.iso, start_time: parsedStart.time, end_time: parsedEnd.time };
}

function dateRange(value) {
  return parseISODateRange(value) !== null;
}

function benchmark(value) {
  return hasText(value, /(?:benchmark|baseline|buy\s*[- ]?and\s*[- ]?hold|cash|index|etf|topix|nikkei|s\s*&?\s*p|msci|market\s+(?:return|index)|reference|risk\s*[- ]?free)/i);
}

function parameterFreeze(value) {
  return hasText(value, /(?:freeze|frozen|lock(?:ed)?|fixed|no\s+(?:further\s+)?(?:parameter|rule|model)\s+(?:change|tuning|optimization))/i)
    && hasText(value, /(?:parameter|rule|model|tuning|configuration)/i)
    && hasText(value, /(?:before|prior\s+to|pre[- ]?holdout|holdout)/i);
}

function fillModel(value) {
  return hasText(value, /(?:bar\s+(?:open|close)|next[- ]?bar\s+(?:open|close)|market(?:\s+order)?|limit(?:\s+order)?|bid|ask|mid|vwap|ohlc|\b(?:open|close)\b)/i);
}

function stressFillModel(value) {
  return fillModel(value) && hasText(value, /(?:stress|conservative|adverse|delay(?:ed)?|worse|worst|one[- ]?bar)/i);
}

const COST_UNIT_RE = /(?:%|bps?|basis\s+points?|ticks?|pips?|points?|(?:usd|jpy|eur|gbp|cents?)\b|per\s+(?:share|contract|unit|order|side|trade)|price\s+units?)/i;
const NUMBER_RE = /(?:\d+(?:\.\d+)?|zero|none|free)/i;

function costAssumption(value) {
  return hasText(value, text => NUMBER_RE.test(text) && COST_UNIT_RE.test(text));
}

function topTradeRemoval(value) {
  return hasText(value, /(?:remove|removal|exclude|drop|without|recompute)/i)
    && hasText(value, /(?:top|largest|winner|winning\s+trade|best\s+trade)/i)
    && hasText(value, /(?:trade|win|winner|\d+\s*%)/i);
}

function regimeSplits(value) {
  const text = textValues(value).filter(text => !PLACEHOLDER_RE.test(text)).join(' ');
  if (!text) return false;
  const concepts = text.match(/(?:trend|range|volatility|risk\s*[- ]?on|risk\s*[- ]?off|bull|bear|session|high|low|breakout|mean\s*reversion)/gi) || [];
  return concepts.length >= 2 && /(?:split|regime|\/|versus|\bvs\.?\b|high\s*[-/]\s*low|risk\s*[- ]?on\s*[-/]\s*risk\s*[- ]?off)/i.test(text);
}

function longShortDecomposition(value) {
  const text = textValues(value).filter(text => !PLACEHOLDER_RE.test(text)).join(' ');
  if (!text) return false;
  const hasLong = /\blong\b/i.test(text);
  const hasShort = /\bshort\b/i.test(text);
  const hasPlan = /(?:separate|decompos|report|metric|split|n\/a|not\s+applicable|reason|long\s*[- ]?only)/i.test(text);
  return hasLong && (hasShort || /long\s*[- ]?only/i.test(text)) && hasPlan;
}

function negativeResultLog(value) {
  // Normalize typographic apostrophes so contractions such as “don’t” follow
  // the same field-scoped path as the ASCII spelling "don't".
  const text = textValues(value)
    .filter(item => !PLACEHOLDER_RE.test(item))
    .join(' ')
    .replace(/[’‘]/g, "'");
  if (!text) return false;
  const aggregateOnly = new RegExp(
    '\\b(?:aggregate|global|overall|summary)[- ]only\\b'
      + '|\\bonly\\s+(?:aggregate|global|overall|summary)(?:\\s+(?:metrics?|results?|outcomes?|performance|scores?))?\\b'
      + '|\\bkeep\\s+only\\s+(?:aggregate|global|overall|summary)(?:\\s+(?:metrics?|results?|outcomes?|performance|scores?))?\\b'
      + '|\\b(?:metrics?|results?|outcomes?|performance|scores?)\\b[^.;]{0,80}\\bonly\\s+in\\s+(?:aggregate|global|overall|summary)\\b'
      + '|\\b(?:aggregate|global|overall|summary)\\s+(?:metrics?|results?|outcomes?|performance|scores?)\\s+only\\b'
      + '|\\b(?:metrics?|results?|outcomes?|performance|scores?)\\s*(?:are|=)\\s*(?:aggregate|global|overall|summary)\\b',
    'i',
  );
  const aggregateMention = /\b(?:aggregate|global|overall|summary)\s+(?:metrics?|results?|outcomes?|performance|scores?)\b/i.test(text);
  const explicitPerVariant = /\b(?:for\s+each|each|every)\s+(?:failed|negative|rejected|losing|underperform(?:ing)?)\s+(?:strategy\s+)?(?:variants?|candidates?|runs?|versions?)\b/i.test(text)
    || /\bper\s*[- ](?:variant|candidate|run|version)\b/i.test(text);
  if (aggregateOnly.test(text) || (aggregateMention && !explicitPerVariant)) return false;
  const explicitlyPreserved = /\b(?:do|does|did)\s*[- ]?not[- ]+(?:discard|delete|drop|omit|remove)\b/i.test(text)
    || /\bdon['’]t\s+(?:discard|delete|drop|omit|remove)\b/i.test(text)
    || /\b(?:do|does|did)\s*[- ]?not[- ]+(?:ignore|exclude)\b/i.test(text)
    || /\bdon['’]t\s+(?:ignore|exclude)\b/i.test(text)
    || /\bnever\s+(?:discard|delete|drop|omit|remove)\b/i.test(text);
  const negativeRetentionTerm = "(?:not|don't|doesn't|didn't|without|no|missing|unknown|unavailable|discard(?:ed|ing)?|omit(?:ted|ting)?|drop(?:ped|ping)?|delet(?:e|ed|ing)|remov(?:e|ed|ing)|ignor(?:e|ed|ing)|exclud(?:e|ed|ing))";
  const retainedField = '(?:parameters?|params?|metrics?|results?|outcomes?|performance|scores?)';
  const negativeFieldGuard = new RegExp(
    `\\b${negativeRetentionTerm}\\b[\\s\\S]{0,120}\\b${retainedField}\\b|\\b${retainedField}\\b[\\s\\S]{0,120}\\b${negativeRetentionTerm}\\b`,
    'i',
  );
  const preservationTerm = '(?:discard|delete|drop|omit|remove|ignore|exclude)';
  const preservedFieldClause = new RegExp(
    `\\b(?:do|does|did)\\s*[- ]?not[- ]+${preservationTerm}\\s+(?:(?:the|its|their|all|any)\\s+)?${retainedField}\\b`
      + `|\\bdon['’]t\\s+${preservationTerm}\\s+(?:(?:the|its|their|all|any)\\s+)?${retainedField}\\b`
      + `|\\bnever\\s+${preservationTerm}\\s+(?:(?:the|its|their|all|any)\\s+)?${retainedField}\\b`,
    'gi',
  );
  // A preservation clause only clears the destructive term for its own field.
  // Any other required field that is negated remains visible to the guard.
  const unnegatedFieldText = text.replace(preservedFieldClause, ' ');
  if (negativeFieldGuard.test(unnegatedFieldText)) return false;
  if (/(?:not|no|without|missing|unknown|unavailable|not\s+available|don't|doesn't|didn't)\s+(?:the\s+)?(?:parameters?|params?|metrics?|results?)/i.test(unnegatedFieldText)
    || /(?:parameters?|params?|metrics?|results?|outcomes?|configuration|settings)\s+(?:missing|unknown|unavailable|not\s+available)/i.test(unnegatedFieldText)) return false;
  const destructive = /\b(?:discard(?:ed|ing)?|delet(?:e|ed|ing)|drop(?:ped|ping)?|omit(?:ted|ting)?|remov(?:e|ed|ing))\b/i.test(text)
    || /\b(?:do|does|did)\s*[- ]?not[- ]+(?:store|retain|record|keep|preserve)\b/i.test(text)
    || /\bdon['’]t\s+(?:store|retain|record|keep|preserve)\b/i.test(text)
    || /\b(?:ignore|ignoring|exclude|excluding)\b/i.test(text)
    || /\bnever\s+(?:store|retain|record|keep|preserve)\b/i.test(text);
  if (destructive && !explicitlyPreserved) return false;
  const retention = /(?:preserve|retain|record|log|store|keep)/i.test(text);
  const failure = /(?:fail(?:ed|ure)?|negative|reject(?:ed)?|underperform|loss|losing)/i.test(text);
  const variant = /(?:variant|candidate|strategy|run|version)/i.test(text);
  const scopedFailure = /\b(?:for\s+each|each|every)\s+(?:failed|negative|rejected|losing|underperform(?:ing)?)\s+(?:strategy\s+)?(?:variants?|candidates?|runs?|versions?)\b/i.test(text)
    || /\b(?:failed|negative|rejected|losing|underperform(?:ing)?)\s+(?:strategy\s+)?(?:variants?|candidates?|runs?|versions?)\b/i.test(text)
    || /\bper\s*[- ]\s*(?:variant(?:s)?|candidate(?:s)?|run(?:s)?|version(?:s)?)\b/i.test(text);
  const scopedEvidence = scopedFailure
    && /\b(?:parameters?|params?|hyperparameters?|configuration|settings)\b/i.test(text)
    && /\b(?:metrics?|results?|outcomes?|performance|scores?)\b/i.test(text);
  return retention && failure && variant && scopedEvidence;
}

function diagnosticTest(value) {
  const text = textValues(value)
    .filter(item => !PLACEHOLDER_RE.test(item))
    .join(' ')
    .replace(/[’‘]/g, "'");
  if (!text) return false;
  const operationVerb = '(?:run|ran|running|execute|executed|executing|perform|performed|performing|apply|applied|applying|test|tested|testing|compare|compared|comparing|remove|removed|removing|drop|dropped|dropping|invert|inverted|inverting|ablate|ablated|ablating|falsify|falsified|falsifying)';
  const variableTerm = '(?:one[- ]?variable|single[- ]?variable)';
  const resultTerm = '(?:result|outcome|finding|metric|observation|effect|impact)';
  const invalidResultModifier = '(?:simulated|expected|planned|anticipated|predicted|hypothetical(?:ly)?)';
  const negativeExecution = new RegExp(
    `\\b(?:(?:(?:do|does|did)\\s*)?(?:not|never|without)|(?:don['’]t|doesn['’]t|didn['’]t))\\s*(?:(?:to|actually|yet|ever|really|having)\\s+)*${operationVerb}\\b[^.;]{0,80}\\b${variableTerm}\\b`
      + `|\\bnot[- ]${operationVerb}\\b[^.;]{0,80}\\b${variableTerm}\\b`
      + `|\\b${operationVerb}\\b[^.;]{0,48}\\b${variableTerm}\\b[\\s\\S]{0,100}\\b(?:(?:was|were|is|are)\\s+not|wasn['’]t|weren['’]t|isn['’]t|aren['’]t|not|never|without)\\b\\s*(?:actually\\s+|yet\\s+|to\\s+|having\\s+)?${operationVerb}\\b`,
    'i',
  );
  const hypotheticalOperation = new RegExp(
    `\\b${invalidResultModifier}\\b[^.;]{0,80}\\b${operationVerb}\\b[^.;]{0,48}\\b${variableTerm}\\b`
      + `|\\b${operationVerb}\\b[^.;]{0,48}\\b${invalidResultModifier}\\b[^.;]{0,48}\\b${variableTerm}\\b`
      + `|\\b${operationVerb}\\b[^.;]{0,48}\\b${variableTerm}\\b[^.;]{0,80}\\b${invalidResultModifier}\\b`,
    'i',
  );
  const invalidResult = new RegExp(
    `\\b${invalidResultModifier}\\b[^.;]{0,80}\\b${resultTerm}\\b`
      + `|\\b${resultTerm}\\b[^.;]{0,80}\\b${invalidResultModifier}\\b`,
    'i',
  );
  if (negativeExecution.test(text)
    || hypotheticalOperation.test(text)
    || invalidResult.test(text)
    || /(?:not|no|without|missing|unknown|unavailable|not\s+available)\s+(?:a\s+)?(?:result|outcome|finding|metric|observation)/i.test(text)
    || /(?:result|outcome|finding|metric|observation)\s+(?:missing|unknown|unavailable|not\s+available)/i.test(text)
    || /(?:expected|planned|anticipated|predicted|hypothetical|simulated)\s+(?:result|outcome|finding|metric|observation|effect|impact)/i.test(text)
    || /(?:result|outcome|finding|metric|observation|effect|impact)\s+(?:expected|planned|anticipated|predicted|hypothetical|simulated)/i.test(text)
    || /\b(?:do|does|did)\s*[- ]?not[- ]+(?:report|record|log|measure|observe|evaluate|document)\b[^.;]*(?:result|outcome|finding|metric|observation)/i.test(text)
    || /\b(?:reject|discard|delete|ignore|omit|suppress)(?:ed|ing)?\b[^.;]*(?:result|outcome|finding|metric|observation)/i.test(text)
    || /\b(?:result|outcome|finding|metric|observation|effect|impact)\b[^.;]{0,80}\bnot\s+(?:recorded|reported|logged|measured|observed|documented)\b/i.test(text)
    || /\b(?:result|outcome|finding|metric|observation|effect|impact)\b[^.;]{0,80}\b(?:rejected|invalid|discarded|unusable|not\s+valid)\b/i.test(text)
    || /\b(?:rejected|invalid|discarded|unusable|not\s+valid)\b[^.;]{0,80}\b(?:result|outcome|finding|metric|observation|effect|impact)\b/i.test(text)
    || /\b(?:do|does|did)\s*[- ]?not[- ]+(?:run|execute|perform|apply|test|compare|remove|drop|invert|ablate|falsif)[^.;]{0,48}\b(?:one[- ]?variable|single[- ]?variable)\b/i.test(text)
    || /\b(?:don['’]t|doesn['’]t|didn['’]t|never)\s+(?:run|execute|perform|apply|test|compare|remove|drop|invert|ablate|falsif)[^.;]{0,48}\b(?:one[- ]?variable|single[- ]?variable)\b/i.test(text)
    || /\b(?:not|without)\s+(?:run|execute|perform|apply|test|compare|remove|drop|invert|ablate|falsif)(?:e|ing|ed|y)?[^.;]{0,48}\b(?:one[- ]?variable|single[- ]?variable)\b/i.test(text)
    || /\b(?:hypothetical(?:ly)?|planned|expected|anticipated|simulated)\b[^.;]{0,80}\b(?:run|execute|perform|apply|test|compare|remove|drop|invert|ablate|falsif)[^.;]{0,48}\b(?:one[- ]?variable|single[- ]?variable)\b/i.test(text)
    || /\b(?:run|execute|perform|apply|test|compare|remove|drop|invert|ablate|falsif)[^.;]{0,48}\b(?:one[- ]?variable|single[- ]?variable)\b[^.;]{0,80}\b(?:hypothetical(?:ly)?|planned|expected|anticipated|simulated)\b/i.test(text)
    || /\b(?:result|outcome|finding|metric|observation|effect|impact)\b\s*(?:is|was|=|:)?\s*(?:n\/a|na|not\s+applicable)\b/i.test(text)) return false;
  const diagnosis = /(?:diagnos|counter[- ]?thesis|failure\s+cause|root\s+cause|regime\s+mismatch|why\s+.*fail)/i.test(text);
  // The execution verb must be adjacent to a one-variable operation. A bare
  // noun such as "one-variable ablation is planned" is intentionally not
  // enough evidence that the diagnostic actually ran.
  const executionVerb = '(?:run|execute|perform|apply|test|compare|remove|drop|invert(?:s|ed|ing)?|ablat(?:e|ed|ing)?|falsif(?:y|ied|ying)?)';
  const variable = variableTerm;
  const operationNoun = '(?:inversion|ablation|removal?|drop(?:ping)?|comparison|falsification|test)';
  const explicitOperationVerb = '(?:invert(?:s|ed|ing)?|ablat(?:e|ed|ing)?|drop(?:ped|ping)?|remov(?:e|ed|ing)|falsif(?:y|ied|ying)?)';
  const operation = new RegExp(
    `\\b${executionVerb}\\b[^.;]{0,48}\\b${variable}\\b[^.;]{0,48}\\b${operationNoun}\\b`
      + `|\\b${executionVerb}\\b[^.;]{0,48}\\b${operationNoun}\\b[^.;]{0,48}\\b${variable}\\b`
      + `|\\b${explicitOperationVerb}\\b[^.;]{0,48}\\b${variable}\\b`,
    'i',
  ).test(text);
  const observationTarget = '(?:result|outcome|finding|metric|observation|effect|impact|pass|fail(?:ure)?|difference|cause)';
  const observationAction = '(?:record|log|report|measure|observe|evaluate|document)(?:ed|ing|s)?';
  const observedQualifier = '(?:actual|observed|measured|recorded|reported|logged|documented)';
  const observation = new RegExp(
    `\\b${observationAction}\\b[^.;]{0,60}\\b${observationTarget}\\b`
      + `|\\b${observedQualifier}\\s+${observationTarget}\\b`
      + `|\\b${observationTarget}\\b\\s*(?:is|was|=|:)?\\s*${observedQualifier}\\b`,
    'i',
  ).test(text);
  return diagnosis && operation && observation;
}

function pointInTimeData(value) {
  const text = textValues(value).filter(item => !PLACEHOLDER_RE.test(item)).join(' ');
  if (!text) return false;
  const inputTerm = /\b(?:factors?|prices?|indicators?|signals?|values?|data)\b/i;
  const staleTerm = /\b(?:current|currently|latest|most\s+recent)\b/i;
  const currentPublishedInputs = staleTerm.test(text) && inputTerm.test(text);
  if (currentPublishedInputs
    || /\bcurrent\b[^.;]*(?:universe|membership|point[- ]in[- ]time|basket|constituents?)\b/i.test(text)
    || /\b(?:present[- ]?bias|current\b[^.;]*(?:factor|price|values?|indicators?|signals?|data))\b/i.test(text)
    || /\b(?:delist(?:ings?|ed\s+names?)?|survivorship(?:[- ]?bias)?|universe|membership)\b[^.;]*(?:excluded|omitted|only\s+if|when[\s-]+available|not[\s-]+required|unknown|missing|ignore|ignored)/i.test(text)
    || /\b(?:lag|publication|release|decision\s+timestamp|available(?:[\s-]+at)?|lookahead)\b[^.;]*(?:only\s+if|when[\s-]+available|not[- ]?required|no\b|without\b|unknown|missing|ignore|ignored|not[- ]?(?:applied|used|available|specified|required))/i.test(text)
    || /\b(?:not|no|without|unknown|missing|ignore|ignoring|omit|omitting|skip|skipping)\b[^.;]*(?:point[- ]in[- ]time|historical\s+(?:universe|membership)|lag|publication|release|decision\s+timestamp|lookahead)/i.test(text)
    || /\b(?:ignore|ignoring|omit|omitting|skip|skipping|exclude|excluding|no|without)\b[^.;]*(?:survivorship(?:[- ]?bias)?|delist(?:ings?|ed\s+names?)?|universe|membership|point[- ]in[- ]time|lag|publication|release|decision\s+timestamp)/i.test(text)
    || /\b(?:unavailable|not[- ]available)\b/i.test(text)
    || /\b(?:no|without|unavailable|not[- ]available)\s+(?:bar\s+)?availability\b/i.test(text)
    || /\b(?:bar\s+)?availability\b[^.;]{0,40}\b(?:no|without|unavailable|not[- ]available|unknown|missing|not[- ]?(?:specified|required))\b/i.test(text)
    || /\b(?:no|without|missing|unknown|unavailable|not[- ]available)\s+(?:ohlcv\s+)?bars?\b/i.test(text)
    || /\b(?:no|without|missing|unknown|unavailable|not[- ]available)\s+data\b/i.test(text)
    || /\b(?:bars?|data)\b[^.;]{0,40}\b(?:missing|unknown|unavailable|not[- ]available)\b/i.test(text)
    || /\b(?:missing|unknown|unavailable|not[- ]?(?:specified|available))\b[^.;]*(?:decision\s+)?availability\b/i.test(text)
    || /lookahead[^.;]*(?:remain|allow|present|bias)/i.test(text)) return false;

  // A zero/negative lag is not an availability control. Apply this before the
  // single-asset exception so that an explicit bad value cannot be hidden by
  // an otherwise valid OHLCV/n-a statement.
  // A strict positive comparator such as "lag > 0 days" is valid. Mask its
  // zero bound only while looking for literal zero/negative lag declarations.
  const lagText = text.replace(/>\s*(?:0+(?:\.0+)?|zero)\b/gi, '> positive-lag-bound');
  const nonPositiveLag = /\b(?:lag|publication\s+lag|release\s+lag)\b[^.;]{0,48}(?:[-−]\s*\d+(?:\.\d+)?|\b0+(?:\.0+)?\b|\bzero\b)/i.test(lagText)
    || /(?:^|[^\w])(?:[-−]\s*\d+(?:\.\d+)?|\b0+(?:\.0+)?\b|\bzero\b)\s*(?:days?|hours?|bars?|periods?)?\s*(?:publication\s+|release\s+)?lag\b/i.test(lagText)
    || /\b(?:no|without|negative)\s+(?:publication\s+|release\s+)?lag\b/i.test(lagText);
  if (nonPositiveLag) return false;

  const singleAssetException = /single[- ]?(?:asset|security|instrument|symbol|name)/i.test(text)
    && /(?:n\/a|not\s+applicable)/i.test(text)
    && /(?:ohlcv|bar|decision\s+time)\b/i.test(text)
    && /\bavailable\b/i.test(text);
  const historicalUniverseOrSurvivorship = /(?:historical\s+(?:universe|membership)|point[- ]in[- ]time\s+(?:universe|membership)|survivorship(?:[- ]?bias)?|delist(?:ings?|ed\s+names?))/i.test(text);
  const positiveLagOrAvailability = /\b(?:publication|release)?\s*lag\b[^.;]*(?:\b(?:at|before|prior\s+to|pre[- ]?decision|decision)\b|\b\d+(?:\.\d+)?\s*(?:seconds?|minutes?|hours?|days?|bars?|periods?)\b)/i.test(text)
    || /\bavailable[- ]at\b/i.test(text)
    || /\bavailability\b[^.;]*(?:timestamp|decision|release|publication|before|prior|at\b)/i.test(text)
    || /\bavailable\b[^.;]*(?:at|before|by|decision|timestamp|release|publication)\b/i.test(text);
  const multiAssetControls = historicalUniverseOrSurvivorship && positiveLagOrAvailability;
  return singleAssetException || multiAssetControls;
}

function leverageFunding(value) {
  const text = textValues(value).filter(item => !PLACEHOLDER_RE.test(item)).join(' ');
  if (!text) return false;
  // Every leverage clause must be concrete. A separate numeric leverage value
  // does not rescue a second clause that is unknown/missing/unavailable.
  const missingLeverageToken = '(?:absent|unspecified|unreported|unprovided|unmeasured|unobserved|not[- ]?(?:measured|given|provided|specified|available|reported|recorded|known)|unknown|missing|unavailable|undefined)';
  if (new RegExp(`\\bleverage\\b[^.;]*${missingLeverageToken}|${missingLeverageToken}[^.;]*\\bleverage\\b`, 'i').test(text)) return false;
  const missingFunding = /\bno\s+funding\s+(?:data|rate)\b/i.test(text)
    || new RegExp(`\\bfunding(?:\\s+(?:data|rate|cost))?\\b[^.;]*${missingLeverageToken}`, 'i').test(text)
    || new RegExp(`\\b${missingLeverageToken}\\s+funding(?:\\s+(?:data|rate|cost))?\\b`, 'i').test(text);
  if (missingFunding || !/\bleverage\b/i.test(text)) return false;

  const leverageValues = [];
  const valueBeforeLeverage = /(-?\d+(?:\.\d+)?)\s*x\b[^.;]*(?:gross\s+)?leverage/gi;
  const leverageValue = /\bleverage\b\s*(?:=|:|at|of)?\s*(-?\d+(?:\.\d+)?)\s*x?\b/gi;
  for (const match of text.matchAll(valueBeforeLeverage)) leverageValues.push(Number(match[1]));
  for (const match of text.matchAll(leverageValue)) leverageValues.push(Number(match[1]));
  if (leverageValues.length === 0 || leverageValues.some(valueNumber => !Number.isFinite(valueNumber) || valueNumber <= 0)) return false;

  // Funding must carry its own outcome. Numbers in nearby leverage/futures
  // prose (for example "funding via 12-month futures") are not funding data.
  const fundingNumeric = /\bfunding(?:\s+(?:data|rate|cost))?\s*(?:(?:is|=|:|at|of|with)\s*)?-?\d+(?:\.\d+)?\s*(?:%|bps?|basis\s+points?)(?![\w-])/i.test(text)
    || /\b-?\d+(?:\.\d+)?\s*(?:%|bps?|basis\s+points?)\s+funding(?:\s+(?:data|rate|cost))?\b/i.test(text);
  const fundingNoneOrZero = /\bfunding(?:\s+(?:data|rate|cost))?\s*(?:(?:is|=|:|at|of|with)\s*)?(?:none|zero)\b/i.test(text)
    || /\b(?:none|zero)\s+funding(?:\s+(?:data|rate|cost))?\b/i.test(text);
  const fundingSpecified = /\bno\s+funding\s+costs?\b/i.test(text)
    || /\bfunding\s+no\s+costs?\b/i.test(text)
    || fundingNumeric
    || fundingNoneOrZero;
  return fundingSpecified;
}

function concentrationCheck(value) {
  const text = textValues(value).filter(item => !PLACEHOLDER_RE.test(item)).join(' ');
  if (!text) return false;
  // Concentration caps/weights are non-negative quantities. Reject an
  // explicitly signed negative number before the looser numeric predicates
  // below can treat its absolute digits as a valid threshold.
  if (/(?:^|[^\w])[−-]\s*\d+(?:\.\d+)?/i.test(text)
    || /\btop\s*[-−]?\s*(?:1|3|5|10)\s*[-−]\s*\d+(?:\.\d+)?/i.test(text)
    || /\btop(?:1|3|5|10)\s*[-−]\s*\d+(?:\.\d+)?/i.test(text)
    || /\bhhi\s*[-−]\s*\d+(?:\.\d+)?/i.test(text)
    || /\bsector\s+max(?:imum)?\s*[-−]\s*\d+(?:\.\d+)?/i.test(text)) return false;
  if (/(?:unknown|missing|unavailable|not\s+available|no\s+(?:measured|reported|defined|specified))/i.test(text)) return false;
  const unrelated = '(?:unrelated|another|separate|independent|different|other)';
  const metricTarget = '(?:metrics?|controls?|fields?|thresholds?|limits?|values?|measures?|ratios?|quantit(?:y|ies)|targets?)';
  if (new RegExp(`\\b${unrelated}\\b`, 'i').test(text)
    || /\b(?:sharpe|sortino|calmar)\s+ratio\b|\bdrawdown\b/i.test(text)
    || new RegExp(`\\b${unrelated}[\\s-]+${metricTarget}\\b`, 'i').test(text)
    || new RegExp(`\\b${metricTarget}\\b[^.;]{0,80}\\b${unrelated}\\b`, 'i').test(text)
    || /\bfor\s+(?:another|a\s+separate|different|unrelated|other)\s+(?:metrics?|controls?|fields?|thresholds?|limits?|values?|measures?|ratios?|quantit(?:y|ies)|targets?)\b/i.test(text)) return false;
  const clauses = text.split(/[.;\n]+/).map(clause => clause.trim()).filter(Boolean);
  return clauses.some(clause => {
    const hasTarget = /(?:concentration|top\s*[- ]?(?:name|1|3|5|10|n)|sector|name|position|pnl\s+contribution|exposure|hhi|herfindahl)/i.test(clause);
    if (!hasTarget) return false;
    const hasNumeric = /(?:\d+(?:\.\d+)?\s*(?:%|bps?|basis\s+points?)|[<>=]\s*\d+(?:\.\d+)?|(?:threshold|cap|max(?:imum)?|limit)\s*(?:at|of|to|=|:|<=|>=)\s*\d+(?:\.\d+)?)/i.test(clause);
    const hasBareHhiNumeric = /\bhhi\b[^.;]*\d+(?:\.\d+)?/i.test(clause);
    const hasAction = /(?:report|check|measure|monitor|track|decompos|attribute|limit|cap|max(?:imum)?|threshold|metric|value|weight|percentage|percent|contribution|hhi|[<>=]\s*\d)/i.test(clause)
      || hasNumeric;
    if (!hasAction) return false;
    const hasContribution = /\b(?:pnl\s+)?contribution\b/i.test(clause);
    const hasHhiValue = /\bhhi\s+(?:value|score|coefficient)\b/i.test(clause);
    return hasNumeric || hasBareHhiNumeric || hasContribution || hasHhiValue;
  });
}

function paperTradePeriod(value) {
  return dateRange(value) || hasText(value, /\d+(?:\.\d+)?\s*(?:day|week|month|year)s?/i);
}


export const REQUIRED_REQUIREMENTS = [
  {
    id: 'id',
    label: 'strategy id',
    paths: [['id'], ['setup'], ['name']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'market',
    label: 'market / universe',
    paths: [['market'], ['universe'], ['symbol_universe']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'timeframe',
    label: 'timeframe',
    paths: [['timeframe'], ['resolution'], ['bar_interval']],
    category: 'identity',
    critical: true,
  },
  {
    id: 'data_source',
    label: 'data source',
    paths: [['data_source'], ['data', 'source'], ['source']],
    category: 'validation',
  },
  {
    id: 'entry',
    label: 'entry condition',
    paths: [['entry'], ['entry_condition'], ['rules', 'entry']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'take_profit',
    label: 'take-profit condition',
    paths: [['exit_take_profit'], ['take_profit'], ['exit', 'take_profit'], ['rules', 'exit_take_profit']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'stop_loss',
    label: 'stop-loss condition',
    paths: [['exit_stop_loss'], ['stop_loss'], ['exit', 'stop_loss'], ['rules', 'exit_stop_loss']],
    category: 'logic',
    critical: true,
  },
  {
    id: 'position_size',
    label: 'position sizing rule',
    paths: [['position_size'], ['position_sizing'], ['risk', 'position_size'], ['rules', 'position_size']],
    category: 'risk',
    critical: true,
  },
  {
    id: 'max_risk_per_trade',
    label: 'max risk per trade',
    paths: [['risk', 'max_risk_per_trade'], ['risk', 'per_trade'], ['max_risk_per_trade']],
    category: 'risk',
  },
  {
    id: 'daily_loss_limit',
    label: 'daily loss limit',
    paths: [['risk', 'daily_loss_limit'], ['daily_loss_limit']],
    category: 'risk',
  },
  {
    id: 'max_concurrent_positions',
    label: 'max concurrent positions',
    paths: [['risk', 'max_concurrent_positions'], ['max_concurrent_positions']],
    category: 'risk',
  },
  {
    id: 'backtest_period',
    label: 'backtest period',
    paths: [['backtest_period'], ['validation', 'backtest_period'], ['backtest', 'period']],
    category: 'validation',
    predicate: dateRange,
  },
  {
    id: 'benchmark',
    label: 'pre-declared benchmark',
    paths: [['benchmark'], ['validation', 'benchmark'], ['backtest', 'benchmark']],
    category: 'validation',
    predicate: benchmark,
  },
  {
    id: 'candidate_count',
    label: 'candidate / parameter search count',
    paths: [['candidate_count'], ['validation', 'candidate_count'], ['search', 'candidate_count']],
    category: 'overfit_guard',
    predicate: positiveInteger,
  },
  {
    id: 'negative_result_log',
    label: 'failed / negative variant retention rule',
    paths: [['negative_result_log'], ['validation', 'negative_result_log'], ['evidence', 'negative_result_log']],
    category: 'evidence',
    predicate: negativeResultLog,
  },
  {
    id: 'diagnostic_test',
    label: 'diagnosis-before-refinement test',
    paths: [['diagnostic_test'], ['validation', 'diagnostic_test'], ['validation', 'counter_thesis_test']],
    category: 'overfit_guard',
    predicate: diagnosticTest,
  },
  {
    id: 'point_in_time_data',
    label: 'point-in-time universe and data-availability rule',
    paths: [['point_in_time_data'], ['validation', 'point_in_time_data'], ['data', 'point_in_time_rule']],
    category: 'data_quality',
    predicate: pointInTimeData,
  },
  {
    id: 'in_sample_period',
    label: 'in-sample period',
    paths: [['in_sample_period'], ['validation', 'in_sample_period'], ['validation', 'is_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'out_of_sample_period',
    label: 'out-of-sample period',
    paths: [['out_of_sample_period'], ['validation', 'out_of_sample_period'], ['validation', 'oos_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'holdout_period',
    label: 'untouched final holdout period',
    paths: [['holdout_period'], ['validation', 'holdout_period']],
    category: 'overfit_guard',
    predicate: dateRange,
  },
  {
    id: 'parameter_freeze',
    label: 'parameter-freeze rule before holdout',
    paths: [['parameter_freeze'], ['validation', 'parameter_freeze'], ['validation', 'freeze_rule']],
    category: 'overfit_guard',
    predicate: parameterFreeze,
  },
  {
    id: 'primary_fill_model',
    label: 'primary fill model',
    paths: [['primary_fill_model'], ['execution', 'primary_fill_model'], ['execution', 'primary_fill']],
    category: 'execution',
    predicate: fillModel,
  },
  {
    id: 'stress_fill_model',
    label: 'conservative stress fill model',
    paths: [['stress_fill_model'], ['execution', 'stress_fill_model'], ['execution', 'stress_fill']],
    category: 'execution',
    predicate: stressFillModel,
  },
  {
    id: 'commission',
    label: 'commission assumption',
    paths: [['commission'], ['execution', 'commission'], ['costs', 'commission']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'spread',
    label: 'spread assumption',
    paths: [['spread'], ['execution', 'spread'], ['costs', 'spread']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'slippage',
    label: 'slippage assumption',
    paths: [['slippage'], ['execution', 'slippage'], ['costs', 'slippage']],
    category: 'execution',
    predicate: costAssumption,
  },
  {
    id: 'leverage_funding',
    label: 'leverage and funding assumption',
    paths: [['leverage_funding'], ['execution', 'leverage_funding'], ['costs', 'leverage_funding']],
    category: 'execution',
    predicate: leverageFunding,
  },
  {
    id: 'top_trade_removal',
    label: 'top 1% / 5% trade-removal check',
    paths: [['top_trade_removal'], ['robustness', 'top_trade_removal']],
    category: 'robustness',
    predicate: topTradeRemoval,
  },
  {
    id: 'regime_splits',
    label: 'regime-split plan',
    paths: [['regime_splits'], ['robustness', 'regime_splits']],
    category: 'robustness',
    predicate: regimeSplits,
  },
  {
    id: 'long_short_decomposition',
    label: 'long / short decomposition',
    paths: [['long_short_decomposition'], ['robustness', 'long_short_decomposition']],
    category: 'robustness',
    predicate: longShortDecomposition,
  },
  {
    id: 'concentration_check',
    label: 'position and PnL concentration check',
    paths: [['concentration_check'], ['robustness', 'concentration_check'], ['risk', 'concentration_check']],
    category: 'robustness',
    predicate: concentrationCheck,
  },
  {
    id: 'paper_trade_period',
    label: 'paper-trade period',
    paths: [['paper_trade'], ['paper_trade_period'], ['validation', 'paper_trade_period']],
    category: 'validation',
    predicate: paperTradePeriod,
  },
  {
    id: 'kill_switch',
    label: 'kill switch',
    paths: [['kill_switch'], ['risk', 'kill_switch']],
    category: 'risk',
  },
  {
    id: 'review_cadence',
    label: 'review cadence',
    paths: [['review_cadence'], ['review', 'cadence']],
    category: 'validation',
  },
  {
    id: 'edge_death_condition',
    label: 'edge death / falsification condition',
    paths: [['edge_death_condition'], ['falsification'], ['kill_condition'], ['review', 'edge_death_condition']],
    category: 'validation',
  },
  {
    id: 'human_confirmation',
    label: 'human confirmation boundary',
    paths: [['human_confirmation'], ['human_approval'], ['execution', 'human_confirmation']],
    category: 'permission',
    critical: true,
    predicate: confirmsHumanBoundary,
  },
];

export function strategySpecTemplate() {
  return {
    id: 'example_setup',
    market: 'stocks_jp',
    timeframe: 'D',
    data_source: 'TradingView OHLCV + official IR/news verification',
    entry: ['Illustrative only: enter long when the 20-day SMA crosses above the 50-day SMA on a daily close and volume is at least its 20-day average.'],
    exit_take_profit: ['Illustrative only: take profit at +2R or when the 20-day SMA closes back below the 50-day SMA.'],
    exit_stop_loss: ['Illustrative only: exit at a close below the entry minus 1 ATR(14); no intraday stop is assumed.'],
    position_size: 'Risk at most 0.5% of equity per trade.',
    risk: {
      max_risk_per_trade: '0.5% equity',
      daily_loss_limit: '1.0% equity; stop reviewing new entries after hit',
      max_concurrent_positions: 3,
      kill_switch: ['API/data failure', 'rule drift', 'manual override required'],
    },
    backtest_period: '2018-01-01..2025-12-31',
    benchmark: ['TOPIX total-return buy-and-hold over the same dates', 'cash at 0% annual return'],
    validation: {
      candidate_count: 1,
      negative_result_log: 'Illustrative only: preserve every failed, losing, rejected, and underperforming strategy variant with its parameters and metrics.',
      diagnostic_test: 'Illustrative only: record a counter-thesis for the failure cause before refinement, then run one one-variable inversion or ablation test.',
      point_in_time_data: 'Illustrative only: use point-in-time historical universe membership including delistings, and apply factor values only after publication lag at the decision timestamp.',
      in_sample_period: '2018-01-01..2021-12-31',
      out_of_sample_period: '2022-01-01..2023-12-31',
      holdout_period: '2024-01-01..2025-12-31',
      parameter_freeze: 'Illustrative only: freeze rules and parameters before opening the final holdout; no holdout-driven retuning.',
    },
    execution: {
      primary_fill_model: 'Illustrative only: fill at the next daily bar open after a signal close.',
      stress_fill_model: 'Illustrative only: conservative one-bar-delayed fill at the following bar open.',
      commission: 'Illustrative only: 0.05% per side primary and 0.10% per side stress.',
      spread: 'Illustrative only: 2 bps primary and 5 bps adverse stress.',
      slippage: 'Illustrative only: 1 tick primary and 3 ticks adverse stress.',
      leverage_funding: 'Illustrative only: 1x gross leverage and funding 0 bps for cash equities; derivatives require observed funding plus an adverse stress rate.',
    },
    robustness: {
      top_trade_removal: 'Illustrative only: recompute after removing the largest win and the top 1% and 5% winning trades.',
      regime_splits: ['trend/range', 'high/low volatility', 'risk-on/risk-off'],
      long_short_decomposition: 'Illustrative only: report long and short metrics separately; use n/a with a documented reason for long-only systems.',
      concentration_check: 'Illustrative only: report top 1, top 3, and top 5 name PnL contribution and sector exposure, with a concentration limit fixed before holdout.',
    },
    paper_trade_period: '2026-01-01..2026-03-31',
    review_cadence: 'weekly paper review; monthly parameter review',
    edge_death_condition: ['PF < 1.0 OOS', 'live/paper gap persists', 'regime mismatch'],
    human_confirmation: {
      required: true,
      live_orders: 'manual only; this spec checker never places orders',
    },
  };
}

function valueAt(obj, pathParts) {
  let cur = obj;
  for (const part of pathParts) {
    if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function meaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === 'object') return Object.values(value).some(meaningful);
  return false;
}

function requirementValueValid(value, requirement) {
  if (!meaningful(value) || !hasConcreteValue(value)) return false;
  return requirement.predicate ? requirement.predicate(value) : true;
}

function firstMatchingValue(spec, requirement) {
  for (const p of requirement.paths) {
    const value = valueAt(spec, p);
    if (requirementValueValid(value, requirement)) return { path: p.join('.'), value };
  }
  return { path: null, value: undefined };
}

export function confirmsHumanBoundary(value) {
  if (value === true) return true;
  if (typeof value === 'string') return HUMAN_CONFIRMATION_RE.test(value);
  if (Array.isArray(value)) return value.some(confirmsHumanBoundary);
  if (value && typeof value === 'object') {
    if (value.required === true || value.manual_only === true || value.hitl === true) return true;
    return Object.values(value).some(confirmsHumanBoundary);
  }
  return false;
}

function strategyId(spec, index) {
  return String(spec?.id || spec?.setup || spec?.name || `strategy_${index + 1}`);
}

function validationPeriod(spec, id) {
  const requirement = REQUIRED_REQUIREMENTS.find(req => req.id === id);
  const found = requirement ? firstMatchingValue(spec, requirement) : { path: null, value: undefined };
  return found.path ? parseISODateRange(found.value) : null;
}

function orderedValidationPeriods(spec) {
  const periods = ['in_sample_period', 'out_of_sample_period', 'holdout_period']
    .map(id => validationPeriod(spec, id));
  if (periods.some(period => !period)) return false;
  for (let i = 1; i < periods.length; i += 1) {
    // Ranges are inclusive. The next period must start after the prior end.
    if (periods[i].start_time <= periods[i - 1].end_time) return false;
  }
  return true;
}

export function checkStrategySpec(spec, index = 0) {
  const checks = REQUIRED_REQUIREMENTS.map(req => {
    const found = firstMatchingValue(spec, req);
    const ok = found.path !== null;
    return {
      id: req.id,
      label: req.label,
      category: req.category,
      critical: Boolean(req.critical),
      ok,
      path: found.path,
    };
  });

  const periodsOrdered = orderedValidationPeriods(spec);
  if (!periodsOrdered) {
    for (const check of checks) {
      if (['in_sample_period', 'out_of_sample_period', 'holdout_period'].includes(check.id)) check.ok = false;
    }
  }

  const missing = checks.filter(c => !c.ok);
  const criticalMissing = missing.filter(c => c.critical);
  const complete = missing.length === 0;
  const nextAction = criticalMissing.length ? 'no-action' : complete ? 'watch' : 'research';

  return {
    id: strategyId(spec, index),
    next_action: nextAction,
    live_order_allowed: false,
    live_gate: 'blocked: human confirmation and deterministic risk controls required before any broker action',
    paper_candidate: complete,
    complete,
    missing: missing.map(c => c.id),
    critical_missing: criticalMissing.map(c => c.id),
    checks,
    validation: {
      periods_ordered_non_overlapping: periodsOrdered,
    },
  };
}

export function normalizeStrategySpecs(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.strategies)) return input.strategies;
  if (input && typeof input === 'object') return [input];
  return [];
}

export function checkStrategyDocument(input) {
  const strategies = normalizeStrategySpecs(input);
  const results = strategies.map((spec, i) => checkStrategySpec(spec, i));
  const byNextAction = results.reduce((acc, r) => {
    acc[r.next_action] = (acc[r.next_action] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    mode: 'read-only-strategy-spec-gate',
    total: results.length,
    complete: results.filter(r => r.complete).length,
    live_order_allowed: false,
    by_next_action: byNextAction,
    results,
  };
}

function requirementLines(result) {
  return result.checks.map(c => `- [${c.ok ? 'x' : ' '}] ${c.id} (${c.label})${c.path ? ` via \`${c.path}\`` : ''}`);
}

export function buildStrategySpecMarkdown(report) {
  const lines = [
    `# Strategy Spec Check — ${report.generated_at.slice(0, 10)}`,
    '',
    '## Boundary',
    '',
    '- Read-only check only. This script never places orders, mutates charts, or touches broker credentials.',
    '- Complete specs are paper/review candidates, not live-trade approval.',
    '- LLM output stays in research/review; trade direction, size, order timing, SL/TP, and kill switches remain deterministic + human-reviewed.',
    '',
    '## Summary',
    '',
    `- Strategies: ${report.total}`,
    `- Complete specs: ${report.complete}`,
    `- Live order allowed: ${report.live_order_allowed ? 'yes' : 'no'}`,
    `- Next actions: ${Object.entries(report.by_next_action).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a'}`,
    '',
  ];

  for (const result of report.results) {
    lines.push(
      `## ${result.id}`,
      '',
      `- next_action: ${result.next_action}`,
      `- paper_candidate: ${result.paper_candidate ? 'yes' : 'no'}`,
      `- live_gate: ${result.live_gate}`,
      `- missing: ${result.missing.length ? result.missing.join(', ') : 'none'}`,
      `- critical_missing: ${result.critical_missing.length ? result.critical_missing.join(', ') : 'none'}`,
      '',
      '### Requirements',
      '',
      ...requirementLines(result),
      '',
    );
  }

  if (report.total === 0) {
    lines.push('## No strategies found', '', '- Provide a JSON object, JSON array, or `{ "strategies": [...] }` document.', '');
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const opts = { file: null, json: false, out: null, template: false, strict: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--template') opts.template = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--out') opts.out = argv[++i] ?? null;
    else if (!opts.file) opts.file = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

function usage() {
  return `Usage: node scripts/strategy_spec_check.js <spec.json> [options]\n\n` +
    `Deterministic read-only gate for trading strategy specifications.\n\n` +
    `Options:\n` +
    `  --template      Print a JSON template instead of checking a file\n` +
    `  --json          Output raw check result as JSON\n` +
    `  --out <path>    Write output to a file\n` +
    `  --strict        Exit 1 when any spec is incomplete or critically missing\n` +
    `  -h, --help      Show help\n`;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }

  if (opts.template) {
    process.stdout.write(`${JSON.stringify(strategySpecTemplate(), null, 2)}\n`);
    return;
  }

  if (!opts.file) throw new Error('Missing <spec.json>. Use --template to print a starter spec.');

  const text = await readFile(path.resolve(process.cwd(), opts.file), 'utf8');
  const report = checkStrategyDocument(JSON.parse(text));
  const output = opts.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : buildStrategySpecMarkdown(report);

  if (opts.out) await writeFile(path.resolve(process.cwd(), opts.out), output, 'utf8');
  else process.stdout.write(output);

  if (opts.strict && report.results.some(r => !r.complete)) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(err => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
  });
}
