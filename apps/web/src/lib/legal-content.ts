export type SharedLegalPageKind = 'privacy' | 'cookie' | 'disclaimer';

export type SharedLegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SharedLegalContent = {
  title: string;
  description: string;
  metadataDescription: string;
  sections: SharedLegalSection[];
  summaryTitle: string;
  summaryDescription: string;
  summaryItems: string[];
  contactTitle: string;
  contactDescription: string;
  contactCtaLabel: string;
};

type SharedLegalContext = {
  siteName: string;
  adsEnabled: boolean;
};

function flushParagraph(paragraphLines: string[], paragraphs: string[]) {
  const text = paragraphLines.join(' ').trim();
  if (text) paragraphs.push(text);
  paragraphLines.length = 0;
}

function flushSection(
  sections: SharedLegalSection[],
  currentTitle: string,
  paragraphLines: string[],
  paragraphs: string[],
  bullets: string[]
) {
  flushParagraph(paragraphLines, paragraphs);
  const normalizedTitle = String(currentTitle || '').trim();
  const normalizedParagraphs = paragraphs.map((item) => item.trim()).filter(Boolean);
  const normalizedBullets = bullets.map((item) => item.trim()).filter(Boolean);
  if (!normalizedTitle && normalizedParagraphs.length === 0 && normalizedBullets.length === 0) {
    paragraphs.length = 0;
    bullets.length = 0;
    return;
  }

  sections.push({
    title: normalizedTitle || 'Section',
    paragraphs: normalizedParagraphs,
    ...(normalizedBullets.length ? { bullets: normalizedBullets } : {})
  });

  paragraphs.length = 0;
  bullets.length = 0;
}

export function buildDefaultLegalPageContent(kind: SharedLegalPageKind, context: SharedLegalContext): SharedLegalContent {
  const { siteName, adsEnabled } = context;

  if (kind === 'privacy') {
    return {
      title: 'Privacy Policy',
      description: `This page explains how ${siteName} may collect, use, and share information when you visit the site, read its content, or contact the editorial team.`,
      metadataDescription: `How ${siteName} handles information collected through the site.`,
      sections: [
        {
          title: 'Information we may collect',
          paragraphs: [
            'We may collect information you choose to send, such as messages submitted through contact forms or other direct outreach methods made available on the site.',
            'We may also collect limited technical and usage information, including browser type, device signals, approximate location, referral source, pages viewed, and interactions that help keep the site secure and functioning properly.'
          ]
        },
        {
          title: 'How information may be used',
          paragraphs: [
            'Information may be used to operate the site, respond to inquiries, maintain security, understand audience engagement, improve content and navigation, and support the business model behind the publication.',
            'We use a practical, limited approach to data handling and only rely on information that is reasonably connected to site operations, performance measurement, editorial improvement, or reader communication.'
          ]
        },
        {
          title: 'Analytics, advertising, and third-party services',
          paragraphs: [
            adsEnabled
              ? 'Advertising features are enabled on this site. Advertising or measurement tools may use cookies or similar technologies to deliver ads, manage frequency, understand performance, and support reporting.'
              : 'This site may use analytics, advertising, or embedded third-party services depending on the tools enabled for this site. When such tools are active, they may use cookies or similar technologies to support delivery, measurement, and functionality.',
            'Some service providers that support hosting, analytics, media delivery, or monetization may receive limited technical or usage data as part of providing those services, subject to their own terms and privacy practices.'
          ]
        },
        {
          title: 'Retention and operational sharing',
          paragraphs: [
            'Information is kept only for as long as reasonably needed to operate the site, maintain security, review performance, handle inquiries, meet legal obligations, or resolve operational issues.',
            'Data may be processed by service providers that help host, secure, analyze, embed, or support the site. These providers act as part of the site infrastructure rather than as independent editorial owners of the content.'
          ]
        },
        {
          title: 'Questions, requests, and policy updates',
          paragraphs: [
            'If you have a question or request related to privacy or information handling on this site, please use the contact page so the request can be reviewed in context.',
            'This policy may be updated from time to time as the site evolves, its tools change, or new publishing and monetization features are enabled.'
          ]
        }
      ],
      summaryTitle: 'How privacy is handled',
      summaryDescription:
        'The site uses a practical, publication-focused approach to information handling built around operations, measurement, and reader support.',
      summaryItems: [
        'Information may include messages you send, device or browser data, and page-level usage signals.',
        adsEnabled
          ? 'Advertising and measurement features are currently enabled and may rely on cookies or similar technologies.'
          : 'Third-party analytics, advertising, or embedded tools may be enabled over time depending on the configuration of this site.',
        'Privacy-related requests should be sent through the contact page.'
      ],
      contactTitle: 'Privacy questions',
      contactDescription:
        'Use the contact page for privacy questions, information-handling concerns, or requests related to data connected with your use of the site.',
      contactCtaLabel: 'Go to contact page'
    };
  }

  if (kind === 'cookie') {
    return {
      title: 'Cookie Policy',
      description:
        'This page explains how cookies and similar technologies may be used on the site to support essential functionality, measurement, preferences, and advertising-related features when enabled.',
      metadataDescription: `How ${siteName} may use cookies and similar technologies.`,
      sections: [
        {
          title: 'What cookies are',
          paragraphs: [
            'Cookies are small text files or similar technologies that can store or read information on your device when you visit a website. They are commonly used to keep a site working, remember settings, understand usage, and support embedded or advertising services.'
          ]
        },
        {
          title: 'Cookie categories',
          paragraphs: ['The site may rely on different categories of cookies or similar technologies depending on the tools currently enabled.'],
          bullets: [
            'Essential cookies that support core site delivery, security, and basic functionality.',
            'Preference cookies that remember settings such as display choices or lightweight personalization.',
            'Analytics or performance cookies that help understand traffic, readership patterns, and site quality.',
            'Advertising or measurement cookies that help deliver promotions, manage frequency, and review campaign performance.'
          ]
        },
        {
          title: 'How this site may use them',
          paragraphs: [
            adsEnabled
              ? 'Advertising features are enabled on this site, so advertising or measurement technologies may be used to support ad delivery, frequency management, reporting, and performance analysis.'
              : 'This site may use analytics, advertising, or embedded third-party tools depending on the services enabled for this site. If those tools are activated, they may place cookies or use similar technologies as part of their normal operation.',
            'Not every category listed above will necessarily be active at all times, and the exact mix may change as the site evolves.'
          ]
        },
        {
          title: 'Managing cookies',
          paragraphs: [
            'Most browsers allow you to control cookies through their settings, including blocking, deleting, or limiting future storage. You can usually review these controls in your browser or device preferences.',
            'Blocking certain technologies may affect how some parts of the site, embedded media, or monetization features function.'
          ]
        },
        {
          title: 'Questions and updates',
          paragraphs: [
            'If you have a question about how cookies or similar technologies are used on this site, please use the contact page.',
            'This policy may be updated as the site adds or removes tools, embedded services, or monetization features.'
          ]
        }
      ],
      summaryTitle: 'What to expect',
      summaryDescription:
        'Cookie use is described by category so the policy remains accurate even when the site configuration changes over time.',
      summaryItems: [
        'Essential technologies may be used to keep the site available and secure.',
        'Analytics, preferences, advertising, or embedded-service technologies may be active depending on the site setup.',
        'Cookie-related questions should be sent through the contact page.'
      ],
      contactTitle: 'Cookie questions',
      contactDescription:
        'Use the contact page for questions about cookie categories, browser controls, or how tracking-related tools may be used on this site.',
      contactCtaLabel: 'Contact the site'
    };
  }

  return {
    title: 'Disclaimer',
    description: `The content published on ${siteName} is general editorial information. This page explains the limits that apply to that content and to any decisions made after reading it.`,
    metadataDescription: `Important content and liability disclaimer for ${siteName}.`,
    sections: [
      {
        title: 'Informational editorial content',
        paragraphs: [
          'This site publishes general informational and editorial content intended to help readers explore ideas, trends, and practical topics in a readable format.',
          'Content is prepared for a broad audience and is not tailored to any specific person, business, jurisdiction, or factual situation.'
        ]
      },
      {
        title: 'No professional advice',
        paragraphs: [
          'Nothing on this site should be treated as legal, medical, financial, tax, therapeutic, or other licensed professional advice.',
          'If a decision could create material, financial, health, safety, or legal consequences, you should review the matter with a qualified professional before acting.'
        ]
      },
      {
        title: 'Accuracy, completeness, and availability',
        paragraphs: [
          'We aim to publish useful, readable, and reasonably current material, but we do not guarantee that every article will always be complete, accurate, current, or suitable for every purpose.',
          'Content, links, tools, and site features may change, move, or become unavailable at any time without notice.'
        ]
      },
      {
        title: 'External links, third parties, and advertising',
        paragraphs: [
          'This site may include links to external websites, embedded media, references to third-party products or services, or other material that is not controlled by the site operator.',
          adsEnabled
            ? 'Advertising features are enabled on this site. Sponsored, promotional, or advertising placements may appear alongside editorial content, but their presence does not by itself amount to a guarantee or endorsement unless explicitly stated.'
            : 'This site may include promotional placements, affiliate-style references, or future advertising features as part of its publishing model. Their presence does not by itself amount to a guarantee or endorsement unless explicitly stated.'
        ]
      },
      {
        title: 'Use at your own risk',
        paragraphs: [
          'Any action you take based on material from this site is taken at your own discretion and risk. You are responsible for evaluating whether information is appropriate for your situation before relying on it.',
          'If you have a concern about a specific page, statement, or external reference, please use the contact page.'
        ]
      }
    ],
    summaryTitle: 'Important limits',
    summaryDescription:
      'The publication is designed to inform and orient readers, not to replace professional judgment or individualized advice.',
    summaryItems: [
      'Articles are general editorial content and are not personalized recommendations.',
      'Professional, medical, legal, financial, and other licensed advice should come from qualified experts.',
      'External links, embedded media, and advertising placements are not automatic endorsements.'
    ],
    contactTitle: 'Content concerns',
    contactDescription:
      'Use the contact page if you want to report an issue, challenge a factual point, or flag content that may need clarification or review.',
    contactCtaLabel: 'Report a concern'
  };
}

export function parseEditableLegalText(rawText: string, fallbackTitle: string): SharedLegalSection[] {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) return [];

  const sections: SharedLegalSection[] = [];
  let currentTitle = '';
  const paragraphLines: string[] = [];
  const paragraphs: string[] = [];
  const bullets: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('## ')) {
      flushSection(sections, currentTitle, paragraphLines, paragraphs, bullets);
      currentTitle = line.slice(3).trim();
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph(paragraphLines, paragraphs);
      bullets.push(line.slice(2).trim());
      continue;
    }
    if (!line) {
      flushParagraph(paragraphLines, paragraphs);
      continue;
    }
    paragraphLines.push(line);
  }

  flushSection(sections, currentTitle, paragraphLines, paragraphs, bullets);

  if (sections.length) {
    return sections.map((section) => ({
      title: section.title || fallbackTitle,
      paragraphs: section.paragraphs,
      ...(section.bullets?.length ? { bullets: section.bullets } : {})
    }));
  }

  return [
    {
      title: fallbackTitle,
      paragraphs: text
        .split(/\n{2,}/)
        .map((item) => item.replace(/\n+/g, ' ').trim())
        .filter(Boolean)
    }
  ];
}
