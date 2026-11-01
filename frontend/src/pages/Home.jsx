import React from 'react';
import Icon from '../components/icons';

const FEATURES = [
  ['scheduler', 'Production scheduling', 'Six classic policies — FCFS, SJF, SRTF, Priority and Round Robin — decide the order jobs run on the floor.'],
  ['safety', 'Safe allocation', "The Banker's Algorithm and deadlock detection keep shared resources allocated without conflict."],
  ['resources', 'Resource management', 'Track machines, workers, raw-material inventory and resource pools from a single console.'],
  ['reports', 'Insight & reports', 'Compare scheduling algorithms side by side, store every run, and review an automatic activity log.'],
];

export default function Home({ onSignIn, theme, onToggleTheme }) {
  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="brand">
            <span className="brand-mark"><Icon name="factory" size={20} /></span>
            <div><div className="brand-name">Smart Factory</div><div className="brand-sub">Production Scheduler</div></div>
          </div>
          <div className="home-nav-actions">
            <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <button className="btn btn-primary" onClick={onSignIn}>Sign in<Icon name="logout" size={15} /></button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Production operations console</span>
          <h1>Schedule production like an operating system.</h1>
          <p>Every production order becomes a process — scheduled by classic algorithms,
          allocated resources safely, and kept consistent across the whole factory floor.</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={onSignIn}>Open the console<Icon name="logout" size={16} /></button>
            <a className="btn btn-lg" href="#features">Explore features</a>
          </div>
        </div>

        {/* Console preview */}
        <div className="hero-visual" aria-hidden="true">
          <div className="console">
            <div className="console-bar"><i /><i /><i /><span>scheduler — run</span></div>
            <div className="console-body">
              <div className="console-line"><span className="c-prompt">▸</span> run scheduler · shortest job first</div>
              <div className="console-gantt">
                {[['#2', 18, 0], ['#4', 10, 18], ['#1', 20, 28], ['#3', 24, 48], ['#6', 28, 72]].map(([id, w, l], i) => (
                  <div key={i} className="cg-bar" style={{ width: `${w}%`, left: `${l}%`, background: PAL[i] }}>{id}</div>
                ))}
              </div>
              <div className="console-kpis">
                <div><span>avg wait</span><b className="num">6.83</b></div>
                <div><span>makespan</span><b className="num">33</b></div>
                <div><span>missed</span><b className="num">1</b></div>
                <div className="c-safe"><span>state</span><b>SAFE</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="home-section">
        <div className="section-head">
          <span className="eyebrow">What it does</span>
          <h2>A factory floor, run by scheduling theory.</h2>
        </div>
        <div className="feature-grid feature-grid-4">
          {FEATURES.map(([ic, title, desc]) => (
            <div className="feature" key={title}>
              <div className="feature-ic"><Icon name={ic} size={20} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="brand">
          <span className="brand-mark"><Icon name="factory" size={18} /></span>
          <div><div className="brand-name">Smart Factory</div><div className="brand-sub">Production Scheduler</div></div>
        </div>
        <p>A web console for production scheduling and resource management.</p>
        <button className="btn btn-primary" onClick={onSignIn}>Sign in</button>
      </footer>
    </div>
  );
}

const PAL = ['#2b6f6a', '#9a6f17', '#c6490f', '#3f6ea0', '#4a8a5a'];
