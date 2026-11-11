import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import ApexCharts from 'vue3-apexcharts'
import App from './App.vue'

import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'
import './style.css'

createApp(App).use(IonicVue).use(ApexCharts).mount('#app')
