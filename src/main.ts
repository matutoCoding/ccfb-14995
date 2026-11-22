import { createApp } from "vue"
import App from "./app.vue"
import { router } from "./router"
import { initStore } from "./data/store"
import "./style.css"

initStore()

createApp(App).use(router).mount("#app")
