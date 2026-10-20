'use strict';

const chapter = context => ({
  task: 'chapter',
  rules: 'Return JSON {name,text,label:"JUDGMENT",confidence}. Name and one sentence grounded in these events and drift. No earlier chapter text is provided. Do not invent facts.',
  context
});
const trigger = context => ({
  task: 'trigger',
  rules: 'Return JSON {status:"fired"|"hold"|"dead", evidence:[{archive,topicId,url}], note, impossible:boolean, label:"JUDGMENT",confidence}. Judge only this trigger against supplied entries. Fired requires a cited entry from the named resolution source OR at least two distinct outlets. Dead only if a sibling fired or the trigger became impossible (explain with cited evidence). A passed due date is not dead; code sets late. A dead trigger seen later fires again. Never infer probabilities.',
  context
});
const line = context => ({
  task: 'line',
  rules: 'Return JSON {text,label:"JUDGMENT",confidence,contradicted:boolean,evidence:[{archive,topicId,url}],reason}. Write one sentence from the current chapter and latest status rows, grounded in supplied events. Mark contradicted only if cited events contradict the previous line, explaining why. Previous dated text is immutable.',
  context
});
module.exports = {
  chapter,
  trigger,
  line
};
