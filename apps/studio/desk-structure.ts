type DeskBuilder = (S: any) => any;

export const deskStructure = (siteSlug?: string): DeskBuilder => {
  const activeSiteSlug = String(siteSlug || '').trim();
  const hasScope = activeSiteSlug.length > 0;
  const titleSuffix = hasScope ? ` (${activeSiteSlug})` : '';
  const params = hasScope ? { siteSlug: activeSiteSlug } : {};

  const listByType = (S: any, typeName: string, title: string) =>
    hasScope
      ? S.documentList().title(title).filter(`_type == "${typeName}" && siteSlug == $siteSlug`).params(params)
      : S.documentTypeList(typeName).title(title);

  return (S: any) =>
    S.list()
      .title(`Buyer Ops${titleSuffix}`)
      .items([
        S.listItem().title('Articles').child(listByType(S, 'article', 'Articles')),
        S.listItem().title('Authors').child(listByType(S, 'authorProfile', 'Authors')),
        S.listItem().title('Categories').child(listByType(S, 'category', 'Categories')),
        S.listItem().title('Tags').child(listByType(S, 'tag', 'Tags')),
        S.divider(),
        S.listItem().title('Publishing Settings').child(listByType(S, 'siteSettings', 'Publishing Settings')),
        S.listItem().title('Topic Queue').child(listByType(S, 'topicCandidate', 'Topic Candidates')),
        S.listItem().title('QA Logs').child(listByType(S, 'qaLog', 'QA Logs')),
        S.listItem().title('Generation Runs').child(listByType(S, 'generationRun', 'Generation Runs')),
        S.divider(),
        S.listItem().title('Legal Pages').child(listByType(S, 'legalPage', 'Legal Pages')),
        S.listItem().title('Prompt Presets').child(listByType(S, 'promptPreset', 'Prompt Presets'))
      ]);
};
