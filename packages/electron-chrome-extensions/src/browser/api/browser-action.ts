import { Menu, MenuItem, session } from 'electron'
import { PopupView } from '../popup'
import { ExtensionEvent } from '../router'
import { ExtensionStore } from '../store'
import { getIconImage, getExtensionUrl } from './common'

const debug = require('debug')('electron-chrome-extensions:browserAction')

interface ExtensionAction {
  color?: string
  text?: string
  title?: string
  icon?:
    | string
    | {
        path: string
      }
  popup?: string
}

type ExtensionActionKey = keyof ExtensionAction

interface ActivateDetails {
  eventType: string
  extensionId: string
  tabId: number
  anchorRect: { x: number; y: number; width: number; height: number }
}

const getBrowserActionDefaults = (extension: Electron.Extension): ExtensionAction | undefined => {
  const manifest = extension.manifest as chrome.runtime.Manifest
  const { browser_action } = manifest
  if (typeof browser_action === 'object') {
    const action: ExtensionAction = {}

    action.title = browser_action.default_title || manifest.name

    const iconImage = getIconImage(extension)
    if (iconImage) action.icon = iconImage.toDataURL()

    if (browser_action.default_popup) {
      action.popup = browser_action.default_popup
    }

    return action
  }
}

interface ExtensionActionStore extends Partial<ExtensionAction> {
  tabs: { [key: string]: ExtensionAction }
}

export class BrowserActionAPI {
  private sessionActionMap = new WeakMap<Electron.Session, Map<string, ExtensionActionStore>>()
  private popup?: PopupView

  private observers: Set<Electron.WebContents> = new Set()
  private queuedUpdate: boolean = false

  constructor(private store: ExtensionStore) {
    const getter =
      (propName: ExtensionActionKey) =>
      ({ sender, extension }: ExtensionEvent, details: chrome.browserAction.TabDetails = {}) => {
        const { tabId } = details
        const senderSession = sender.session
        const action = this.getAction(senderSession, extension.id)

        let result

        if (tabId) {
          if (action.tabs[tabId]) {
            result = action.tabs[tabId][propName]
          } else {
            result = action[propName]
          }
        } else {
          result = action[propName]
        }

        return result
      }

    const setter =
      (propName: ExtensionActionKey) =>
      ({ sender, extension }: ExtensionEvent, details: chrome.browserAction.TabDetails) => {
        const { tabId } = details
        let value = (details as any)[propName] || undefined

        if (typeof value === 'undefined') {
          const defaults = getBrowserActionDefaults(extension)
          value = defaults ? defaults[propName] : value
        }

        const valueObj = { [propName]: value }

        const senderSession = sender.session
        const action = this.getAction(senderSession, extension.id)

        if (tabId) {
          const tabAction = action.tabs[tabId] || (action.tabs[tabId] = {})
          Object.assign(tabAction, valueObj)
        } else {
          Object.assign(action, valueObj)
        }

        this.onUpdate()
      }

    const handleProp = (prop: string, key: ExtensionActionKey) => {
      store.handle(`browserAction.get${prop}`, getter(key))
      store.handle(`browserAction.set${prop}`, setter(key))
    }

    handleProp('BadgeBackgroundColor', 'color')
    handleProp('BadgeText', 'text')
    handleProp('Title', 'title')
    handleProp('Popup', 'popup')
    store.handle('browserAction.setIcon', setter('icon'))

    // browserAction preload API
    const preloadOpts = { allowRemote: true, extensionContext: false }
    store.handle('browserAction.getState', this.getState.bind(this), preloadOpts)
    store.handle('browserAction.activate', this.activate.bind(this), preloadOpts)
    store.handle(
      'browserAction.addObserver',
      (event) => {
        const { sender: webContents } = event
        this.observers.add(webContents)
        webContents.once('destroyed', () => {
          this.observers.delete(webContents)
        })
      },
      preloadOpts
    )
    store.handle(
      'browserAction.removeObserver',
      (event) => {
        const { sender: webContents } = event
        this.observers.delete(webContents)
      },
      preloadOpts
    )

    this.store.on('active-tab-changed', () => {
      this.onUpdate()
    })

    this.setupSession(this.store.session)
  }

  private setupSession(session: Electron.Session) {
    // TODO: Extension events need to be backported from Electron v12
    const _session = session as any

    _session.on('extension-loaded', (event: Electron.Event, extension: Electron.Extension) => {
      this.processExtension(session, extension)
    })

    _session.on('extension-unloaded', (event: Electron.Event, extension: Electron.Extension) => {
      this.removeActions(this.store.session, extension.id)
    })
  }

  private getSessionActions(session: Electron.Session) {
    let sessionActions = this.sessionActionMap.get(session)
    if (!sessionActions) {
      sessionActions = new Map()
      this.sessionActionMap.set(session, sessionActions)
      this.onUpdate()
    }
    return sessionActions
  }

  private getAction(session: Electron.Session, extensionId: string) {
    const sessionActions = this.getSessionActions(session)

    let action = sessionActions.get(extensionId)
    if (!action) {
      action = { tabs: {} }
      sessionActions.set(extensionId, action)
      this.onUpdate()
    }

    return action
  }

  // TODO: Make private after backporting extension registry events
  removeActions(session: Electron.Session, extensionId: string) {
    const sessionActions = this.getSessionActions(session)

    if (sessionActions.has(extensionId)) {
      sessionActions.delete(extensionId)
    }

    if (sessionActions.size === 0) {
      this.sessionActionMap.delete(session)
    }

    this.onUpdate()
  }

  private getPopupUrl(session: Electron.Session, extensionId: string, tabId: number) {
    const action = this.getAction(session, extensionId)
    console.log(`getPopupUrl ${extensionId}`, action)
    const popupPath = action.tabs[tabId]?.popup || action.popup || undefined
    return popupPath && `chrome-extension://${extensionId}/${popupPath}`
  }

  // TODO: Make private after backporting extension registry events
  processExtension(session: Electron.session, extension: Electron.Extension) {
    const defaultAction = getBrowserActionDefaults(extension)
    if (defaultAction) {
      const action = this.getAction(session, extension.id)
      Object.assign(action, defaultAction)
    }
  }

  private getState(event: ExtensionEvent, partition?: string) {
    const ses =
      typeof partition === 'string' ? session.fromPartition(partition) : event.sender.session
    const sessionActions = this.sessionActionMap.get(ses)
    const actions = sessionActions
      ? Array.from(sessionActions.entries()).map((val: any) => ({ id: val[0], ...val[1] }))
      : []
    const activeTab = this.store.getActiveTabOfCurrentWindow()
    return { activeTabId: activeTab?.id, actions }
  }

  private activate({ sender }: ExtensionEvent, details: ActivateDetails) {
    const { eventType, extensionId, tabId } = details

    debug(
      `activate [eventType: ${eventType}, extensionId: '${extensionId}', tabId: ${tabId}, senderId: ${sender.id}]`
    )

    switch (eventType) {
      case 'click':
        this.activateClick(details)
        break
      case 'contextmenu':
        this.activateContextMenu(details)
        break
      default:
        console.debug(`Ignoring unknown browserAction.activate event '${eventType}'`)
    }
  }

  private activateClick(details: ActivateDetails) {
    const { extensionId, tabId, anchorRect } = details

    if (this.popup) {
      const toggleExtension = !this.popup.isDestroyed() && this.popup.extensionId === extensionId
      this.popup.destroy()
      this.popup = undefined
      if (toggleExtension) {
        debug('skipping activate to close popup')
        return
      }
    }

    const tab = tabId >= 0 ? this.store.getTabById(tabId) : this.store.getActiveTabOfCurrentWindow()
    if (!tab) {
      throw new Error(`Unable to get active tab`)
    }

    const popupUrl = this.getPopupUrl(tab.session, extensionId, tab.id)

    if (popupUrl) {
      const win = this.store.tabToWindow.get(tab)
      if (!win) {
        throw new Error('Unable to get BrowserWindow from active tab')
      }

      this.popup = new PopupView({
        extensionId,
        session: this.store.session,
        parent: win,
        url: popupUrl,
        anchorRect,
      })

      debug(`opened popup: ${popupUrl}`)

      this.store.emitPublic('browser-action-popup-created', this.popup)
    } else {
      debug(`dispatching onClicked for ${extensionId}`)

      const tabDetails = this.store.tabDetailsCache.get(tab.id)
      this.store.sendToExtensionHost(extensionId, 'browserAction.onClicked', tabDetails)
    }
  }

  private activateContextMenu(details: ActivateDetails) {
    const { extensionId, tabId, anchorRect } = details

    const extension = this.store.session.getExtension(extensionId)
    if (!extension) {
      throw new Error(`Unregistered extension '${extensionId}'`)
    }

    const menu = new Menu()
    const append = (opts: Electron.MenuItemConstructorOptions) => menu.append(new MenuItem(opts))
    const appendSeparator = () => menu.append(new MenuItem({ type: 'separator' }))

    append({
      label: extension.name,
      // TODO: either open to extension-defined webpage or Chrome web store?
      enabled: true,
      click: () => {
        this.store.createTab({ url: `https://chrome.google.com/webstore/detail/${extension.id}` })
      },
    })

    appendSeparator()

    const contextMenuItems: MenuItem[] = this.store.buildMenuItems(extensionId, 'browser_action')
    if (contextMenuItems.length > 0) {
      contextMenuItems.forEach((item) => menu.append(item))
      appendSeparator()
    }

    const optionsPage = extension.manifest.options_page || extension.manifest.options_ui?.page
    const optionsPageUrl = optionsPage ? getExtensionUrl(extension, optionsPage) : undefined

    append({
      label: 'Options',
      enabled: typeof optionsPageUrl === 'string',
      click: () => {
        this.store.createTab({ url: optionsPageUrl })
      },
    })

    menu.popup({
      x: anchorRect.x,
      y: anchorRect.y + anchorRect.height,
    })
  }

  private onUpdate() {
    if (this.queuedUpdate) return
    this.queuedUpdate = true
    queueMicrotask(() => {
      this.queuedUpdate = false
      debug(`dispatching update to ${this.observers.size} observer(s)`)
      Array.from(this.observers).forEach((observer) => {
        if (!observer.isDestroyed()) {
          observer.send('browserAction.update')
        }
      })
    })
  }
}
