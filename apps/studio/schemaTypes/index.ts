import { aiMetaType } from './objects/aiMeta';
import { faqItemType } from './objects/faqItem';
import { internalLinkType } from './objects/internalLink';
import { articleType } from './documents/article';
import { authorProfileType } from './documents/authorProfile';
import { categoryType } from './documents/category';
import { generationRunType } from './documents/generationRun';
import { legalPageType } from './documents/legalPage';
import { promptPresetType } from './documents/promptPreset';
import { qaLogType } from './documents/qaLog';
import { siteSettingsType } from './documents/siteSettings';
import { tagType } from './documents/tag';
import { topicCandidateType } from './documents/topicCandidate';

export const schemaTypes = [
  faqItemType,
  aiMetaType,
  internalLinkType,
  siteSettingsType,
  authorProfileType,
  categoryType,
  tagType,
  topicCandidateType,
  articleType,
  promptPresetType,
  qaLogType,
  generationRunType,
  legalPageType
];
