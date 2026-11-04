import React from 'react';
import Icon from '../components/icons';

const FEATURES = [
  ['scheduler', 'Production scheduling', 'FCFS, SJF, SRTF, Priority and Round Robin, written in C++, with a Gantt chart and waiting, turnaround and response times.'],
  ['cpu', 'Machines and workers', 'Each running order holds one machine slot and one worker, so only as many orders run as the factory has free.'],
  ['safety', "Banker's Algorithm", 'Requests for machines and workers are checked for a safe state. Deadlocks are detected and can be recovered from.'],
  ['warehouse', 'Inventory', 'Raw materials and a ledger of every change to the stock.'],
  ['reports', 'Reports', 'Scheduling history, algorithm comparison, machine use and worker workload from SQL views.'],
];

const STEPS = [
  ['Add the factory', 'Add your machines and workers, and the raw materials you keep in stock.'],
  ['Create orders', 'Each order has an arrival time, run time, priority, deadline and the machine type it needs.'],
  ['Schedule and run', 'Pick an algorithm, see the Gantt chart, then start the orders. The Banker\'s check keeps resources safe.'],
];

export default function Home({ onSignIn }) {
  return (
    <div className="home">
      <header className="home-nav">
        <div className="brand">
          <span className="brand-mark"><Icon name="factory" size={20} /></span>
          <div className="brand-name">Smart Factory</div>
        </div>
        <nav className="home-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <button className="btn" onClick={onSignIn}>Sign in</button>
      </header>

      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-text">
            <h1>Schedule factory production like an operating system</h1>
            <p>
              Every production order is a process. The factory's machines and workers are the
              limited resources they share. Schedule orders, allocate resources safely and keep
              everything in MySQL.
            </p>
            <div className="home-cta">
              <button className="btn btn-primary btn-lg" onClick={onSignIn}>Get started</button>
              <a className="btn btn-lg home-btn-light" href="#how">See how it works</a>
            </div>
          </div>
          <div className="home-hero-card">
            <div className="home-hero-row"><span className="home-hero-ic t0"><Icon name="scheduler" size={18} /></span><div><b>6 algorithms</b><span>FCFS, SJF, SRTF, Priority (2 kinds), Round Robin</span></div></div>
            <div className="home-hero-row"><span className="home-hero-ic t1"><Icon name="safety" size={18} /></span><div><b>Banker's Algorithm</b><span>Safe-state check and deadlock detection</span></div></div>
            <div className="home-hero-row"><span className="home-hero-ic t2"><Icon name="resources" size={18} /></span><div><b>MySQL</b><span>Views, procedures, triggers and transactions</span></div></div>
            <div className="home-hero-row"><span className="home-hero-ic t3"><Icon name="cpu" size={18} /></span><div><b>C++ engine</b><span>All the OS algorithms run in C++</span></div></div>
          </div>
        </div>
      </section>

      <section id="how" className="home-section">
        <h2>How it works</h2>
        <div className="home-steps">
          {STEPS.map(([title, text], i) => (
            <div className="home-step" key={title}>
              <span className="home-step-n">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="home-section home-section-alt">
        <h2>What's inside</h2>
        <div className="home-features">
          {FEATURES.map(([icon, title, text], i) => (
            <div className="home-feature" key={title}>
              <span className={`home-feature-ic t${i % 6}`}><Icon name={icon} size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span>Smart Factory Production Scheduler</span>
        <button className="btn btn-primary" onClick={onSignIn}>Sign in</button>
      </footer>
    </div>
  );
}
