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
        'Claude Code 상태줄 플러그인 — 컨텍스트, 비용, 속도제한, 28개 위젯',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/uppinote20/claude-dashboard',
        },
        {
          icon: 'blueSky',
          label: 'Blog',
          href: 'https://blog.uppinote.dev',
        },
      ],
      defaultLocale: 'root',
      locales: {
        root: {
          label: '한국어',
          lang: 'ko',
        },
        en: {
          label: 'English',
          lang: 'en',
        },
      },
      sidebar: [
        {
          label: '시작하기',
          translations: { en: 'Getting Started' },
          items: [
            'getting-started/installation',
            'getting-started/quick-start',
          ],
        },
        {
          label: '가이드',
          translations: { en: 'Guides' },
          items: [
            'guides/display-modes',
            'guides/widgets',
            'guides/themes',
            'guides/configuration',
            'guides/presets',
          ],
        },
        {
          label: '레퍼런스',
          translations: { en: 'Reference' },
          items: [
            'reference/commands',
            'reference/widget-reference',
            'reference/config-schema',
          ],
        },
        'troubleshooting',
        {
          label: '관련 글',
          translations: { en: 'Blog Posts' },
          items: [
            {
              label: 'claude-dashboard 개발기',
              translations: { en: 'Building claude-dashboard' },
              link: 'https://blog.uppinote.dev/tag/claude-dashboard/',
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
      ],
    }),
  ],
});
