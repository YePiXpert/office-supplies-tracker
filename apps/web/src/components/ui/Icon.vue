<script setup lang="ts">
const props = withDefaults(
  defineProps<{ name: string; size?: number | string }>(),
  { size: 16 },
);

/** 线性图标集（lucide 风格，stroke 2px） */
const PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
  ledger: 'M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm3 5h6M9 11h6M9 15h4',
  kanban: 'M4 3h5v13H4zM15 3h5v8h-5zM15 15h5v6h-5zM4 18h5v3H4z',
  import: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  distribution: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10',
  inventory: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v10',
  report: 'M5 20V10M12 20V4M19 20v-7',
  supplier: 'M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M9 14h.01M15 10h.01M15 14h.01',
  audit: 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4zm-3 9l2 2 4-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.6-3a8.6 8.6 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.6 8.6 0 0 0-2-1.2L15.7 3h-4l-.4 2.6a8.6 8.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.6 8.6 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8.6 8.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8.6 8.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2l-4.35-4.35',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  upload: 'M12 15V3m0 0L8 7m4-4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z',
  restore: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  edit: 'M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  close: 'M18 6L6 18M6 6l12 12',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v10',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  history: 'M3 3v6h6M3.5 9A9 9 0 1 1 3 15M12 7v5l3 3',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 0v6h6',
  key: 'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7 7 5 5 0 0 1 7-7zm0 0L15 8m0 0l3 3 3-3-3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-16v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  undo: 'M3 7v6h6M3.5 13a9 9 0 1 0 2.1-5.7L3 10',
  sort: 'M8 7l4-4 4 4M8 17l4 4 4-4',
  'sort-asc': 'M12 20V4M12 4l-5 5M12 4l5 5',
  'sort-desc': 'M12 4v16M12 20l-5-5M12 20l5-5',
  paperclip: 'M21.4 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm2 12l5-5 4 4 3-3 4 4M8.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  filter: 'M3 4h18l-7 8v7l-4 2v-9L3 4z',
  sparkles: 'M12 3l1.9 5.6a2 2 0 0 0 1.3 1.3L20.8 12l-5.6 1.9a2 2 0 0 0-1.3 1.3L12 20.8l-1.9-5.6a2 2 0 0 0-1.3-1.3L3.2 12l5.6-1.9a2 2 0 0 0 1.3-1.3L12 3zM19 3v3M17.5 4.5h3',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
};
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[props.name] ?? PATHS.box" />
  </svg>
</template>
