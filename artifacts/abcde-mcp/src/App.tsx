import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getGetPublicStatsQueryKey, useGetPublicStats } from '@workspace/api-client-react';
import { ArrowDownRight, Check, Copy, Leaf } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Language = 'lv' | 'en';

function publicEndpoint(value: string | undefined): string {
  if (!value?.trim()) return '';
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash ||
      !/^\/mcp\/?$/.test(url.pathname) ||
      host === 'localhost' || host.endsWith('.localhost') ||
      host === '127.0.0.1' || host === '[::1]' ||
      host.endsWith('.replit.dev')
    ) return '';
    return url.toString();
  } catch {
    return '';
  }
}

const copyPrompts = {
  en: [
    'Suggest a high-protein shopping list for 3 people using Rimi and Maxima. Show package quantities and explain missing nutrition data.',
    'Find breakfast foods with at least 10 g protein per 100 g. Keep the original product names.',
    'Suggest lower-sugar snack alternatives and show their sugar values and Nutri-Score.',
    'Compare protein-rich options from Rimi and Maxima and group the shopping list by retailer.',
  ],
  lv: [
    'Iesaki ar olbaltumvielām bagātu iepirkumu sarakstu 3 cilvēkiem no Rimi un Maxima. Norādi iepakojumu skaitu un paskaidro, kuri uzturvērtības dati trūkst.',
    'Atrodi brokastu produktus ar vismaz 10 g olbaltumvielu uz 100 g. Saglabā oriģinālos produktu nosaukumus.',
    'Iesaki uzkodu alternatīvas ar mazāku cukura daudzumu un norādi cukura daudzumu un Nutri-Score.',
    'Salīdzini ar olbaltumvielām bagātus produktus no Rimi un Maxima un sagrupē iepirkumu sarakstu pa veikaliem.',
  ],
};

const translations = {
  en: {
    eyebrow: 'A more thoughtful way to shop',
    heading: <>Build a healthier<br />shopping list <em>with AI</em></>,
    intro: 'Explore Rimi and Maxima products with nutrition data and retailer links. Connect Claude, describe your goals, and review your list.',
    heroLink: 'See how to connect Claude',
    visualCaption: 'Food data, made useful',
    stepsKicker: 'A simple three-step flow',
    stepsTitle: 'From a question to a list.',
    stepsIntro: 'Your assistant does the exploring. You stay in control of what goes in your basket.',
    steps: [
      ['Connect Claude', 'Add ABCDE MCP as a custom connector in Claude. It connects to a real, read-only food data server.'],
      ['Ask about foods and nutrition', 'Describe what matters to you. Claude can explore Rimi and Maxima product information and nutrition values.'],
      ['Review, then shop', 'Review the suggested list and follow product links to Rimi or Barbora. Purchases happen on retailer websites.'],
    ],
    setupKicker: 'One-time setup',
    setupTitle: 'Connect Claude to ABCDE MCP.',
    setupIntro: 'Available to individual Pro and Max users. No sign-in is needed for this public connector.',
    endpointLabel: 'Public MCP endpoint',
    endpointMissing: 'The public endpoint is not published yet. A copyable URL will appear here once it is available.',
    copyUrl: 'Copy URL',
    copied: 'Copied',
    copyFailed: 'Could not copy. Select and copy the URL manually.',
    stepsSetup: [
      <>In Claude, open <strong>Customize &gt; Connectors &gt; + Add &gt; Add custom connector</strong>.</>,
      <>Name the connector <strong>ABCDE MCP</strong>.</>,
      <>Paste the public <strong>/mcp URL</strong> shown here.</>,
      <>Choose <strong>No sign in</strong>, then finish adding the connector.</>,
    ],
    adminNote: 'Team and Enterprise owners may control connector access. Individual Pro/Max users can add a custom connector from Customize > Connectors; Team/Enterprise owners configure it for members.',
    promptsKicker: 'Try asking Claude',
    promptsTitle: 'Start with a useful question.',
    promptsIntro: 'Copy a prompt, paste it into Claude, and adjust it to fit your household.',
    promptCopyLabel: 'Copy prompt',
    promptsCopied: 'Prompt copied.',
    promptsCopyFailed: 'Could not copy. Please select and copy the prompt.',
    limitsKicker: 'Useful to know',
    limitsTitle: 'Clear data. Clear boundaries.',
    limitations: [
      <><strong>Nutrition data can be missing.</strong> When a source does not specify the basis, mass-based per-100 g figures are an assumption.</>,
      <>Suggestions are <strong>not medical advice</strong>. Ingredient analysis is not allergy safety.</>,
      <>Verified prices and live stock availability are not provided. <strong>Check retailer websites</strong> for current details.</>,
      <>Lists link to Rimi or Barbora, but do not create carts or orders, or check out. Maxima product links lead to Barbora.</>,
      <>ABCDE MCP is independent and not affiliated with Rimi, Maxima, or Barbora. Purchases happen on retailer websites.</>,
      <>There is no embedded assistant. Claude connects to a real, read-only MCP server for Rimi and Maxima nutrition data.</>,
    ],
    usageKicker: 'Open project, transparent counters',
    usageTitle: 'A little about usage.',
    toolCalls: 'Aggregate tool calls',
    toolCallsCaption: 'Calls recorded by the MCP service',
    sessions: 'Measured MCP sessions',
    sessionless: 'Not measured for sessionless clients',
    sessionsCaption: 'This server uses a sessionless transport and does not store session IDs or hashes.',
    toolLoading: 'Loading',
    statsUnavailable: 'Currently unavailable',
    privacy: 'Only aggregate tool-call counters and short-lived rate-limit buckets are stored. Queries and session IDs are not stored by the application. This server is sessionless, so no session hashes are collected. Infrastructure operational logs may exist.',
    footer: 'Built by ABCDE Open Food Data Lab',
    footerTag: 'Independent Latvian / English project',
    langLabel: 'Language',
  },
  lv: {
    eyebrow: 'Pārdomātāks veids, kā iepirkties',
    heading: <>Veido veselīgāku<br />iepirkumu sarakstu <em>ar MI</em></>,
    intro: 'Izpēti Rimi un Maxima produktus, uzturvērtības datus un saites uz tirgotājiem. Pievieno Claude, apraksti savus mērķus un pārskati sarakstu.',
    heroLink: 'Uzzini, kā savienot Claude',
    visualCaption: 'Pārtikas dati noderīgā veidā',
    stepsKicker: 'Vienkārši — trīs soļos',
    stepsTitle: 'No jautājuma līdz sarakstam.',
    stepsIntro: 'Claude palīdz izpētīt. Tu izlem, ko pievienot savam pirkumu grozam.',
    steps: [
      ['Pievieno Claude', 'Pievieno ABCDE MCP Claude kā pielāgotu savienotāju. Tas savienojas ar īstu, tikai lasāmu pārtikas datu serveri.'],
      ['Jautā par pārtiku un uzturvērtību', 'Apraksti, kas tev ir svarīgi. Claude var izpētīt Rimi un Maxima produktu informāciju un uzturvērtības datus.'],
      ['Pārskati un iepērcies', 'Pārskati ieteikto sarakstu un seko produktu saitēm uz Rimi vai Barbora. Pirkumi notiek tirgotāju vietnēs.'],
    ],
    setupKicker: 'Jāiestata tikai vienreiz',
    setupTitle: 'Savieno Claude ar ABCDE MCP.',
    setupIntro: 'Pieejams individuāliem Pro un Max lietotājiem. Šim publiskajam savienotājam nav nepieciešama pierakstīšanās.',
    endpointLabel: 'Publiskais MCP galapunkts',
    endpointMissing: 'Publiskais galapunkts vēl nav publicēts. Kad tas būs pieejams, šeit varēsi nokopēt tā adresi.',
    copyUrl: 'Kopēt adresi',
    copied: 'Nokopēts',
    copyFailed: 'Neizdevās nokopēt. Lūdzu, iezīmē un nokopē adresi manuāli.',
    stepsSetup: [
      <>Claude atver <strong>Customize &gt; Connectors &gt; + Add &gt; Add custom connector</strong>.</>,
      <>Nosauc savienotāju <strong>ABCDE MCP</strong>.</>,
      <>Ielīmē šeit norādīto publisko <strong>/mcp URL</strong>.</>,
      <>Izvēlies <strong>No sign in</strong> un pabeidz savienotāja pievienošanu.</>,
    ],
    adminNote: 'Team un Enterprise plānu administratori var ierobežot savienotāju pievienošanu. Individuālie Pro/Max lietotāji pielāgotu savienotāju pievieno sadaļā Customize > Connectors; Team/Enterprise īpašnieki to konfigurē dalībniekiem.',
    promptsKicker: 'Izmēģini ar Claude',
    promptsTitle: 'Sāc ar noderīgu jautājumu.',
    promptsIntro: 'Nokopē piemēru, ielīmē to Claude un pielāgo savas mājsaimniecības vajadzībām.',
    promptCopyLabel: 'Kopēt uzvedni',
    promptsCopied: 'Uzvedne nokopēta.',
    promptsCopyFailed: 'Neizdevās nokopēt. Lūdzu, iezīmē un nokopē uzvedni.',
    limitsKicker: 'Svarīgi zināt',
    limitsTitle: 'Skaidri dati. Skaidras robežas.',
    limitations: [
      <><strong>Uzturvērtības dati var nebūt pieejami.</strong> Ja avotā nav norādīts aprēķina pamats, vērtības uz 100 g pēc masas ir pieņēmums.</>,
      <>Ieteikumi <strong>nav medicīnisks padoms</strong>. Sastāvdaļu analīze negarantē alerģiju drošību.</>,
      <>Pārbaudītas cenas un aktuāli krājumu dati nav pieejami. <strong>Pārbaudi tirgotāju vietnes</strong>, lai uzzinātu aktuālo informāciju.</>,
      <>Sarakstu saites ved uz Rimi vai Barbora, bet neveido grozus vai pasūtījumus un neveic pirkumu. Maxima produktu saites ved uz Barbora.</>,
      <>ABCDE MCP ir neatkarīgs projekts, kas nav saistīts ar Rimi, Maxima vai Barbora. Pirkumi notiek tirgotāju vietnēs.</>,
      <>Iegultas sarunu saskarnes nav. Claude pieslēdzas īstam, tikai lasāmam MCP serverim ar Rimi un Maxima uzturvērtības datiem.</>,
    ],
    usageKicker: 'Atvērts projekts, pārskatāmi skaitītāji',
    usageTitle: 'Par lietojumu.',
    toolCalls: 'Kopējais rīka izsaukumu skaits',
    toolCallsCaption: 'MCP pakalpojuma reģistrētie izsaukumi',
    sessions: 'Uzskaitītās MCP sesijas',
    sessionless: 'Nav mērīts klientiem bez sesijas',
    sessionsCaption: 'Šis serveris darbojas bez sesijām un nesaglabā sesiju identifikatorus vai jaucējkodus.',
    toolLoading: 'Ielādē',
    statsUnavailable: 'Pašlaik nav pieejams',
    privacy: 'Lietotne saglabā tikai apkopotus rīku izsaukumu skaitītājus un īslaicīgus pieprasījumu ierobežojumu skaitītājus. Vaicājumi un sesiju identifikatori netiek saglabāti. Serveris darbojas bez sesijām, tāpēc sesiju jaucējkodi netiek vākti. Infrastruktūras darbības žurnāli var tikt veidoti.',
    footer: 'Veidojis ABCDE Open Food Data Lab',
    footerTag: 'Neatkarīgs projekts latviešu / angļu valodā',
    langLabel: 'Valoda',
  },
};

function Home() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem('abcde-mcp-language') === 'en' ? 'en' : 'lv';
    } catch {
      return 'lv';
    }
  });
  const [announcement, setAnnouncement] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const { data: stats, isLoading, isError } = useGetPublicStats({
    query: { queryKey: getGetPublicStatsQueryKey(), refetchInterval: 30_000 },
  });
  const content = translations[language];
  const endpoint = publicEndpoint(import.meta.env.VITE_PUBLIC_MCP_URL);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('abcde-mcp-language', language);
    } catch {
      // Language preference remains available for the current visit.
    }
  }, [language]);

  async function copyText(value: string, successMessage: string, failureMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setAnnouncement(successMessage);
    } catch {
      setAnnouncement(failureMessage);
    }
  }

  async function copyPrompt(prompt: string, index: number) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(index);
      setAnnouncement(content.promptsCopied);
      window.setTimeout(() => setCopiedPrompt((current) => current === index ? null : current), 1800);
    } catch {
      setAnnouncement(content.promptsCopyFailed);
    }
  }

  const formatCount = (value: number) => new Intl.NumberFormat(language === 'lv' ? 'lv-LV' : 'en').format(value);
  const statsUnavailable = isError || !stats;

  return (
    <main className="site-shell" data-testid="page-landing">
      <header className="topbar" data-testid="section-header">
        <a className="brand" href="#top" aria-label="ABCDE MCP home" data-testid="link-home">
          <span className="brand-mark" aria-hidden="true">abc</span>
          <span className="brand-name">ABCDE <span className="brand-note">MCP</span></span>
        </a>
        <div className="language-switch" role="group" aria-label={content.langLabel} data-testid="control-language">
          <button type="button" onClick={() => setLanguage('lv')} aria-pressed={language === 'lv'} data-testid="button-language-lv">LV</button>
          <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} data-testid="button-language-en">EN</button>
        </div>
      </header>

      <section className="hero" id="top" data-testid="section-hero">
        <div className="hero-copy-block">
          <div className="eyebrow">{content.eyebrow}</div>
          <h1 data-testid="text-hero-heading">{content.heading}</h1>
          <p className="hero-copy" data-testid="text-hero-intro">{content.intro}</p>
          <div className="hero-actions">
            <a className="text-link" href="#connect">{content.heroLink}<ArrowDownRight size={16} aria-hidden="true" /></a>
            <span className="brand-note">READ-ONLY · RIMI + MAXIMA</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustration of food data connected to Rimi and Maxima" role="img" data-testid="visual-food-data">
          <div className="visual-orbit">
            <span className="orbit-label label-rimi">Rimi</span>
            <span className="orbit-label label-maxima">Maxima</span>
            <span className="orbit-label label-nutrition">Nutrition data</span>
            <div className="food-sun"><div className="visual-center">ABCDE</div></div>
          </div>
          <span className="visual-caption">{content.visualCaption}</span>
        </div>
      </section>

      <section className="steps-section" id="how-it-works" data-testid="section-steps">
        <div className="section-wrap">
          <div className="steps-heading">
            <div>
              <div className="section-kicker">{content.stepsKicker}</div>
              <h2 className="section-title">{content.stepsTitle}</h2>
            </div>
            <p className="section-intro">{content.stepsIntro}</p>
          </div>
          <div className="steps-grid">
            {content.steps.map(([title, description], index) => (
              <article className="step" key={title} data-testid={`card-step-${index + 1}`}>
                <span className="step-number">0{index + 1} / 03</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="setup-section" id="connect" data-testid="section-setup">
        <div className="section-wrap setup-grid">
          <div>
            <div className="section-kicker">{content.setupKicker}</div>
            <h2 className="section-title">{content.setupTitle}</h2>
            <p className="section-intro">{content.setupIntro}</p>
            <div className="connector-url" data-testid="status-endpoint">
              <div className="connector-url-label">{content.endpointLabel}</div>
              {endpoint ? (
                <div className="url-line">
                  <code className="url-value" data-testid="text-public-endpoint">{endpoint}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyText(endpoint, content.copied, content.copyFailed)}
                    aria-label={content.copyUrl}
                    data-testid="button-copy-endpoint"
                  >
                    <Copy size={14} aria-hidden="true" />{content.copyUrl}
                  </button>
                </div>
              ) : (
                <div className="url-line">
                  <span className="url-value" data-testid="text-endpoint-unpublished">{content.endpointMissing}</span>
                  <button type="button" className="copy-button" disabled aria-disabled="true" data-testid="button-copy-endpoint-disabled">
                    <Copy size={14} aria-hidden="true" />{content.copyUrl}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <ol className="setup-list">
              {content.stepsSetup.map((step, index) => <li key={index} data-testid={`text-setup-step-${index + 1}`}>{step}</li>)}
            </ol>
            <p className="admin-note" data-testid="text-admin-note">{content.adminNote}</p>
          </div>
        </div>
      </section>

      <section className="prompts-section" id="prompts" data-testid="section-prompts">
        <div className="section-wrap">
          <div className="prompts-heading">
            <div>
              <div className="section-kicker">{content.promptsKicker}</div>
              <h2 className="section-title">{content.promptsTitle}</h2>
            </div>
            <p className="section-intro">{content.promptsIntro}</p>
          </div>
          <div className="prompt-list">
            {copyPrompts[language].map((prompt, index) => (
              <article className="prompt-card" key={`${language}-${index}`} data-testid={`card-prompt-${index + 1}`}>
                <span className="prompt-index">0{index + 1}</span>
                <div className="prompt-text" data-testid={`text-prompt-${index + 1}`}>{prompt}</div>
                <button
                  type="button"
                  className="prompt-copy"
                  onClick={() => copyPrompt(prompt, index)}
                  aria-label={`${content.promptCopyLabel} ${index + 1}`}
                  title={content.promptCopyLabel}
                  data-testid={`button-copy-prompt-${index + 1}`}
                >
                  {copiedPrompt === index ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="limits-section" data-testid="section-limitations">
        <div className="section-wrap limits-grid">
          <div>
            <div className="section-kicker">{content.limitsKicker}</div>
            <h2 className="section-title">{content.limitsTitle}</h2>
          </div>
          <ul className="limits-list">
            {content.limitations.map((item, index) => <li key={index} data-testid={`text-limitation-${index + 1}`}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="usage-section" data-testid="section-usage">
        <div className="section-wrap">
          <div className="usage-head">
            <div>
              <div className="section-kicker">{content.usageKicker}</div>
              <h2 className="section-title">{content.usageTitle}</h2>
            </div>
            <Leaf size={26} strokeWidth={1.5} color="#477756" aria-hidden="true" />
          </div>
          <div className="usage-grid" aria-live="polite" data-testid="status-public-stats">
            <div className="usage-stat">
              <div className="usage-label">{content.toolCalls}</div>
              <div className="usage-value" data-testid="value-tool-calls">
                {isLoading ? <span className="loading-value" aria-label={content.toolLoading} /> : statsUnavailable ? <span className="unavailable">{content.statsUnavailable}</span> : formatCount(stats.toolCalls)}
              </div>
              <div className="usage-caption">{content.toolCallsCaption}</div>
            </div>
            <div className="usage-stat">
              <div className="usage-label">{content.sessions}</div>
              <div className="usage-value" data-testid="value-measured-sessions">
                {isLoading ? <span className="loading-value" aria-label={content.toolLoading} /> : statsUnavailable ? <span className="unavailable">{content.statsUnavailable}</span> : stats.measuredSessions === null ? <span className="unavailable">{content.sessionless}</span> : formatCount(stats.measuredSessions)}
              </div>
              <div className="usage-caption">{content.sessionsCaption}</div>
            </div>
          </div>
          <p className="privacy-note" data-testid="text-privacy-note">{content.privacy}</p>
        </div>
      </section>

      <footer className="footer" data-testid="section-footer">
        <div className="footer-inner">
          <p>{content.footer} · <a href="https://abcde.lv" target="_blank" rel="noreferrer" data-testid="link-abcde">abcde.lv</a></p>
          <span className="footer-tag">{content.footerTag}</span>
        </div>
      </footer>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="status-copy-announcement">{announcement}</div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
