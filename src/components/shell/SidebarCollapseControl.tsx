"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SidebarCollapseControl.module.css";

const STORAGE_KEY = "ffz:sidebar-collapsed";

type ShellParts = {
  shell: HTMLElement;
  sidebar: HTMLElement;
  nav: HTMLElement;
};

function discoverShell(): ShellParts | null {
  const nav = document.querySelector<HTMLElement>('aside nav[aria-label="Main navigation"]');
  const sidebar = nav?.closest<HTMLElement>("aside") ?? null;
  const shell = sidebar?.parentElement ?? null;

  if (!nav || !sidebar || !shell) return null;
  return { shell, sidebar, nav };
}

function annotateSidebar(parts: ShellParts) {
  const { sidebar, nav, shell } = parts;

  shell.dataset.ffzShellRoot = "true";
  sidebar.dataset.ffzSidebarRoot = "true";

  const brand = sidebar.firstElementChild as HTMLElement | null;
  const sidebarBottom = sidebar.lastElementChild as HTMLElement | null;
  if (brand) {
    brand.dataset.ffzBrand = "true";
    const logoFrame = brand.firstElementChild as HTMLElement | null;
    if (logoFrame) logoFrame.dataset.ffzLogoFrame = "true";
  }
  if (sidebarBottom) sidebarBottom.dataset.ffzSidebarBottom = "true";

  for (const section of Array.from(nav.children)) {
    const sectionElement = section as HTMLElement;
    sectionElement.dataset.ffzNavSection = "true";

    const title = sectionElement.children[0] as HTMLElement | undefined;
    const list = sectionElement.children[1] as HTMLElement | undefined;
    if (title) title.dataset.ffzNavTitle = "true";
    if (!list) continue;

    list.dataset.ffzNavList = "true";

    for (const entryNode of Array.from(list.children)) {
      const entry = entryNode as HTMLElement;
      entry.dataset.ffzNavEntry = "true";

      const triggerWrap = entry.children[0] as HTMLElement | undefined;
      const trigger = triggerWrap?.querySelector<HTMLAnchorElement>(":scope > a") ?? null;
      if (!trigger) continue;

      const label = trigger.textContent?.trim() || "Navigation";
      trigger.dataset.ffzNavTrigger = "true";
      trigger.dataset.ffzLabel = label;
      trigger.title = label;

      const triggerSpans = trigger.querySelectorAll<HTMLElement>(":scope > span");
      triggerSpans[0]?.setAttribute("data-ffz-nav-icon", "true");
      triggerSpans[1]?.setAttribute("data-ffz-nav-label", "true");

      const groupToggle = triggerWrap?.querySelector<HTMLButtonElement>(":scope > button") ?? null;
      if (groupToggle) {
        groupToggle.dataset.ffzNavToggle = "true";
        trigger.dataset.ffzHasChildren = "true";
      } else {
        trigger.dataset.ffzHasChildren = "false";
      }

      const subNav = entry.children[1] as HTMLElement | undefined;
      if (subNav) {
        subNav.dataset.ffzNavSubnav = "true";
        subNav.dataset.ffzParentLabel = label;
      }
    }
  }
}

function applyCollapsedState(parts: ShellParts, collapsed: boolean) {
  const value = collapsed ? "true" : "false";
  parts.shell.dataset.ffzSidebarCollapsed = value;
  parts.sidebar.dataset.ffzSidebarCollapsed = value;

  const entries = parts.nav.querySelectorAll<HTMLElement>("[data-ffz-nav-entry='true']");
  for (const entry of Array.from(entries)) {
    const subNav = entry.querySelector<HTMLElement>(":scope > [data-ffz-nav-subnav='true']");
    if (!subNav) continue;

    const toggle = entry.querySelector<HTMLButtonElement>("[data-ffz-nav-toggle='true']");
    const links = subNav.querySelectorAll<HTMLAnchorElement>("a");

    if (collapsed) {
      subNav.setAttribute("aria-hidden", "false");
      for (const link of Array.from(links)) link.tabIndex = 0;
      continue;
    }

    const expanded = toggle?.getAttribute("aria-expanded") === "true";
    subNav.setAttribute("aria-hidden", String(!expanded));
    for (const link of Array.from(links)) link.tabIndex = expanded ? 0 : -1;
  }
}

export function SidebarCollapseControl() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const partsRef = useRef<ShellParts | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Local storage is optional; the control still works for the current session.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function discover() {
      if (cancelled) return;
      const parts = discoverShell();
      if (!parts) return;

      partsRef.current = parts;
      annotateSidebar(parts);
      setReady(true);
    }

    discover();
    const observer = new MutationObserver(discover);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!ready || !partsRef.current) return;
    applyCollapsedState(partsRef.current, collapsed);

    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore storage errors; visual state remains valid.
    }
  }, [collapsed, ready]);

  if (!ready) return null;

  return (
    <button
      type="button"
      className={`${styles.toggle} ${collapsed ? styles.toggleCollapsed : ""}`}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={() => setCollapsed((current) => !current)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14.5 6-6 6 6 6" />
      </svg>
    </button>
  );
}
