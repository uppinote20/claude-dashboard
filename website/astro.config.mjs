import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://claude-dashboard.uppinote.dev',
  integrations: [
    starlight({
      title: {
        ko: 'claude-dashboard',
        en: 'claude-dashboard',
      },
      description:
        'Comprehensive status line plugin for Claude Code — context, cost, rate limits, 25+ widgets',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/uppinote20/claude-dashboard',
        },
      ],
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ko: {
          label: '한국어',
          lang: 'ko',
        },
      },
      sidebar: [
        {
          label: 'Getting Started',
          translations: { ko: '시작하기' },
          items: [
            'getting-started/installation',
            'getting-started/quick-start',
          ],
        },
        {
          label: 'Guides',
          translations: { ko: '가이드' },
          items: [
            'guides/display-modes',
            'guides/widgets',
            'guides/themes',
            'guides/configuration',
            'guides/presets',
          ],
        },
        {
          label: 'Reference',
          translations: { ko: '레퍼런스' },
          items: [
            'reference/commands',
            'reference/widget-reference',
            'reference/config-schema',
          ],
        },
        'troubleshooting',
        {
          label: 'Blog Posts',
          translations: { ko: '관련 글' },
          items: [
            {
              label: 'claude-dashboard Plugin Guide',
              translations: { ko: 'claude-dashboard 플러그인 가이드' },
              link: 'https://blog.uppinote.dev/claude-dashboard-plugin-guide/',
              attrs: { target: '_blank' },
            },
            {
              label: 'v1.10–v1.13: Themes, Performance, Alias',
              translations: { ko: 'v1.10~v1.13 테마·성능·별칭' },
              link: 'https://blog.uppinote.dev/claude-dashboard-v1-10-to-v1-13-theme-performance-alias/',
              attrs: { target: '_blank' },
            },
            {
              label: 'Claude Code Docs: Status Line',
              translations: { ko: 'Claude Code 공식 문서: Status Line' },
              link: 'https://code.claude.com/docs/en/statusline#display-multiple-lines',
              attrs: { target: '_blank' },
            },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: '/og-image.png',
          },
        },
        {
          tag: 'script',
          content: `document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.social-icons a, a[rel="me"]').forEach(a=>{if(a.hostname!==location.hostname)a.setAttribute('target','_blank')})})`,
        },
      ],
    }),
  ],
});
