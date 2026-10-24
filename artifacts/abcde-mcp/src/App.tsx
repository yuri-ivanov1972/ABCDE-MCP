import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getGetPublicStatsQueryKey, useGetPublicStats } from '@workspace/api-client-react';
import { ArrowDownRight, Check, Copy, Leaf } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { copyPrompts, translations, type Language } from './page-content';
import { publicEndpoint, sitePath, verifiedMcpEndpoint } from './site-config';

const queryClient = new QueryClient();
function Home({ language }: { language: Language }) {
  const [mounted, setMounted] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const { data: stats, isLoading, isError } = useGetPublicStats({
    query: { queryKey: getGetPublicStatsQueryKey(), refetchInterval: 30_000, enabled: mounted },
  });
  const content = translations[language];
  const endpoint = publicEndpoint(import.meta.env.VITE_PUBLIC_MCP_URL ?? verifiedMcpEndpoint);
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    setMounted(true);
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
          <a href={sitePath(base)} hrefLang="lv" lang="lv" aria-current={language === 'lv' ? 'page' : undefined} data-testid="button-language-lv">LV</a>
          <a href={sitePath(base, 'en/')} hrefLang="en" lang="en" aria-current={language === 'en' ? 'page' : undefined} data-testid="button-language-en">EN</a>
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
          <p className="privacy-note">{content.statsStaticNote}</p>
        </div>
      </section>

      <footer className="footer" data-testid="section-footer">
        <div className="footer-inner">
          <p>{content.footer} · <a href="https://abcde.lv" target="_blank" rel="noreferrer" data-testid="link-abcde">abcde.lv</a></p>
          <div className="footer-tag">
            <span>{content.footerTag}</span>
            {' · '}<a href={sitePath(base, `content/${language}.md`)}>{language === 'lv' ? 'Saturs Markdown formātā' : 'Content as Markdown'}</a>
            {' · '}<a href={sitePath(base, 'llms.txt')}>llms.txt</a>
          </div>
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
        <Route path="/"><Home language="lv" /></Route>
        <Route path="/en"><Home language="en" /></Route>
        <Route path="/en/"><Home language="en" /></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App({ ssrPath }: { ssrPath?: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')} ssrPath={ssrPath}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
