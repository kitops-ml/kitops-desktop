import { createRouter, createWebHashHistory } from 'vue-router'

import CompareView from '../views/CompareView.vue'
import DiskUsageView from '../views/DiskUsageView.vue'
import HomeView from '../views/HomeView.vue'
import InitFromDirectoryView from '../views/InitFromDirectoryView.vue'
import KitfileEditorView from '../views/KitfileEditorView.vue'
import KitFlowView from '../views/KitFlowView.vue'
import LogsView from '../views/LogsView.vue'
import ModelKitDetailView from '../views/ModelKitDetailView.vue'
import NewKitfileView from '../views/NewKitfileView.vue'
import SettingsView from '../views/SettingsView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/new',
    name: 'new-kitfile',
    component: NewKitfileView,
  },
  {
    path: '/new/init-from-directory',
    name: 'init-from-directory',
    component: InitFromDirectoryView,
  },
  {
    path: '/edit/:id?',
    name: 'edit-kitfile',
    component: KitfileEditorView,
  },
  {
    path: '/modelkits/:repository/:tag',
    name: 'modelkit-detail',
    component: ModelKitDetailView,
  },
  {
    path: '/compare/:repository/:tag',
    name: 'compare',
    component: CompareView,
  },
  {
    path: '/kitflow',
    name: 'kitflow',
    component: KitFlowView,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
  },
  {
    path: '/logs',
    name: 'logs',
    component: LogsView,
  },
  {
    path: '/disk-usage',
    name: 'disk-usage',
    component: DiskUsageView,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
