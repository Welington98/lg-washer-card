import { LitElement, html, css } from "lit";

const CARD_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Editor (visual config)
// ---------------------------------------------------------------------------
class LgWasherCardEditor extends LitElement {
  constructor() {
    super();
    this._config = {};
  }

  static get properties() {
    return { hass: {}, _config: {} };
  }

  setConfig(config) {
    this._config = config;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const key = target.configValue;
    if (!key) return;
    const value = target.value;
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const fields = [
      { key: "name", label: "Nome do Card", type: "text" },
      { key: "model", label: "Modelo (ex: LG VC4)", type: "text" },
      { key: "brand", label: "Marca / Subtítulo (ex: LG ThinQ)", type: "text" },
      { key: "entity", label: "Entidade principal da lavadora", type: "entity" },
      { key: "temp_entity", label: "Entidade de temperatura da água", type: "entity" },
      { key: "spin_entity", label: "Entidade de velocidade de centrifugação", type: "entity" },
      { key: "course_entity", label: "Entidade do ciclo atual", type: "entity" },
      { key: "power_switch", label: "Switch de energia", type: "entity" },
      { key: "course_select", label: "Seletor de operação (select.*)", type: "entity" },
      { key: "pause_button", label: "Botão de pausar", type: "entity" },
      { key: "start_button", label: "Botão de iniciar remotamente", type: "entity" },
    ];

    return html`
      <div class="card-config">
        ${fields.map((f) =>
          f.type === "entity"
            ? html`
                <ha-entity-picker
                  .label="${f.label}"
                  .hass=${this.hass}
                  .value=${this._config[f.key] || ""}
                  .configValue=${f.key}
                  @value-changed=${this._valueChanged}
                  allow-custom-entity
                ></ha-entity-picker>
              `
            : html`
                <ha-textfield
                  .label="${f.label}"
                  .value=${this._config[f.key] || ""}
                  .configValue=${f.key}
                  @input=${this._valueChanged}
                ></ha-textfield>
              `
        )}
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 0;
      }
      ha-entity-picker,
      ha-textfield {
        width: 100%;
      }
    `;
  }
}

customElements.define("lg-washer-card-editor", LgWasherCardEditor);

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------
class LgWasherCard extends LitElement {
  constructor() {
    super();
    this._config = {};
  }

  static get properties() {
    return { hass: {}, _config: {} };
  }

  static getConfigElement() {
    return document.createElement("lg-washer-card-editor");
  }

  static getStubConfig(hass) {
    const entities = Object.keys(hass.states);
    return {
      name: "Lavadora",
      model: "LG VC4",
      brand: "LG ThinQ",
      entity: entities.find((e) => e.startsWith("sensor.lavadora")) || "",
      temp_entity: entities.find((e) => e.includes("water_temp")) || "",
      spin_entity: entities.find((e) => e.includes("spin_speed")) || "",
      course_entity: entities.find((e) => e.includes("current_course")) || "",
      power_switch: entities.find((e) => e.startsWith("switch.lavadora")) || "",
      course_select: entities.find((e) => e.includes("course_selection")) || "",
      pause_button: entities.find((e) => e.includes("pause")) || "",
      start_button: entities.find((e) => e.includes("remote_start")) || "",
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error("A entidade principal da lavadora é obrigatória.");
    this._config = config;
  }

  getCardSize() {
    return 6;
  }

  _entity(key) {
    const id = this._config[key];
    return id && this.hass ? this.hass.states[id] : null;
  }

  _attr(key, attr) {
    const e = this._entity(key);
    return e && e.attributes ? e.attributes[attr] : null;
  }

  get _isOn() {
    const e = this._entity("entity");
    return e && e.state !== "off" && e.state !== "unavailable";
  }

  _toSeconds(timeStr) {
    if (!timeStr) return 0;
    return timeStr.split(":").reduce((acc, t) => 60 * acc + parseInt(t, 10), 0);
  }

  get _progress() {
    const initial = this._attr("entity", "initial_time") || "0:01:00";
    const remain = this._attr("entity", "remain_time") || "0:01:00";
    const totalSec = this._toSeconds(initial);
    if (totalSec === 0 || !this._isOn) return 0;
    return Math.min(Math.round(((totalSec - this._toSeconds(remain)) / totalSec) * 100), 100);
  }

  get _remainTime() {
    const remain = this._attr("entity", "remain_time");
    if (!remain) return "00:00";
    const parts = remain.split(":");
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : remain;
  }

  get _runState() {
    return this._attr("entity", "run_state") || "PRONTA";
  }

  _callService(domain, service, entityId) {
    this.hass.callService(domain, service, { entity_id: entityId });
  }

  _togglePower() {
    const sw = this._config.power_switch;
    if (!sw) return;
    const swEntity = this.hass.states[sw];
    const service = swEntity && swEntity.state === "on" ? "turn_off" : "turn_on";
    this._callService("switch", service, sw);
  }

  _showMoreInfo() {
    const entityId = this._config.entity;
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  _pressPause() {
    const btn = this._config.pause_button;
    if (btn) this._callService("button", "press", btn);
  }

  _pressStart() {
    const btn = this._config.start_button;
    if (btn) this._callService("button", "press", btn);
  }

  _selectCourse(ev) {
    const entityId = this._config.course_select;
    if (!entityId) return;
    this.hass.callService("select", "select_option", {
      entity_id: entityId,
      option: ev.target.value,
    });
  }

  render() {
    if (!this._config || !this.hass) return html``;

    const isOn = this._isOn;
    const progress = this._progress;
    const remainTime = this._remainTime;
    const runState = this._runState;
    const name = this._config.name || "Lavadora";
    const model = this._config.model || "";
    const brand = this._config.brand || "";

    const tempEntity = this._entity("temp_entity");
    const spinEntity = this._entity("spin_entity");
    const courseEntity = this._entity("course_entity");
    const courseSelectEntity = this._entity("course_select");
    const courseOptions = courseSelectEntity?.attributes?.options || [];
    const selectedCourse = courseSelectEntity?.state || "";

    return html`
      <ha-card>
        <div class="washer-card ${isOn ? "" : "washer-off"}">

          <!-- Header -->
          <div class="header">
            <div class="header-title">
              <div class="brand">${brand}</div>
              <div class="model-row">
                <span class="model">${name}</span>
                <span class="model-sub">${model}</span>
              </div>
            </div>
            <button
              class="power-btn ${isOn ? "power-on" : "power-off"}"
              @click=${this._togglePower}
              title="Ligar/Desligar"
            >
              <ha-icon icon="mdi:power"></ha-icon>
            </button>
          </div>

          <!-- Visual -->
          <div class="visual">
            <div class="icon-wrap ${isOn ? "icon-on" : ""}" @click=${this._showMoreInfo} style="cursor:pointer">
              <div class="icon-blur ${isOn ? "pulse" : ""}"></div>
              <ha-icon
                icon="mdi:washing-machine"
                class="main-icon ${isOn ? "icon-active" : "icon-inactive"}"
              ></ha-icon>
              <ha-icon
                icon="mdi:sync"
                class="spin-ring ${isOn ? "rotating" : ""}"
              ></ha-icon>
            </div>

            <div class="status-wrap">
              <span class="state-badge ${isOn ? "badge-on" : "badge-off"}">
                ${isOn ? runState : "PRONTA"}
              </span>
              <div class="time-display">
                <ha-icon icon="mdi:clock-outline" class="time-icon"></ha-icon>
                ${remainTime}
              </div>
            </div>
          </div>

          <!-- Progress -->
          <div class="progress-section">
            <div class="progress-label">
              <span>PROGRESSO</span>
              <span>${progress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
          </div>

          <!-- Info -->
          <div class="info-grid">
            ${tempEntity ? html`
              <div class="info-item">
                <ha-icon icon="mdi:thermometer" class="info-icon" style="color:#fb923c"></ha-icon>
                <div class="info-label">TEMP</div>
                <div class="info-value">${tempEntity.state}°C</div>
              </div>
            ` : ""}
            ${spinEntity ? html`
              <div class="info-item">
                <ha-icon icon="mdi:weather-windy" class="info-icon" style="color:#93c5fd"></ha-icon>
                <div class="info-label">CENTRIF.</div>
                <div class="info-value">${spinEntity.state}</div>
              </div>
            ` : ""}
            ${courseEntity ? html`
              <div class="info-item">
                <ha-icon icon="mdi:sync" class="info-icon" style="color:#4ade80"></ha-icon>
                <div class="info-label">CICLO</div>
                <div class="info-value course-value">${courseEntity.state}</div>
              </div>
            ` : ""}
          </div>

          <!-- Course selector -->
          ${courseOptions.length > 0 ? html`
            <div class="course-selector-section">
              <div class="course-selector-label">
                <ha-icon icon="mdi:tune-vertical-variant" class="course-selector-icon"></ha-icon>
                <span>OPERAÇÃO</span>
              </div>
              <select
                class="course-select"
                .value=${selectedCourse}
                @change=${this._selectCourse}
                ?disabled=${isOn}
              >
                ${courseOptions.map((opt) => html`
                  <option value=${opt} ?selected=${opt === selectedCourse}>${opt}</option>
                `)}
              </select>
            </div>
          ` : ""}

          <!-- Controls -->
          <div class="controls">
            <button class="ctrl-btn" @click=${this._pressPause} title="Pausar">
              <div class="ctrl-icon-wrap">
                <ha-icon icon="mdi:pause"></ha-icon>
              </div>
              <span class="ctrl-label">PAUSAR</span>
            </button>

            <button class="ctrl-btn ctrl-primary" @click=${this._pressStart} title="Iniciar">
              <div class="ctrl-icon-wrap ctrl-icon-primary">
                <ha-icon icon="mdi:play"></ha-icon>
              </div>
              <span class="ctrl-label ctrl-label-primary">INICIAR</span>
            </button>

            <button class="ctrl-btn ctrl-disabled" disabled title="Adiar">
              <div class="ctrl-icon-wrap">
                <ha-icon icon="mdi:clock-plus-outline"></ha-icon>
              </div>
              <span class="ctrl-label">ADIAR</span>
            </button>
          </div>

        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ha-card {
        background: #0f172a;
        border-radius: 2.5rem;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, 0.2);
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        color: white;
      }

      .washer-card {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
      }
      .brand {
        font-size: 10px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .model-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-top: 2px;
      }
      .model {
        font-size: 18px;
        font-weight: 600;
      }
      .model-sub {
        font-size: 14px;
        font-weight: 300;
        color: #94a3b8;
      }
      .power-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }
      .power-off {
        background: rgba(51, 65, 85, 0.5);
        color: #94a3b8;
        box-shadow: none;
      }
      .power-on {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
      }
      .power-btn ha-icon {
        --mdc-icon-size: 20px;
      }

      /* Visual */
      .visual {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 0 24px;
      }
      .icon-wrap {
        position: relative;
        padding: 32px;
        border-radius: 50%;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .icon-blur {
        position: absolute;
        width: 100%;
        height: 100%;
        background: rgba(59, 130, 246, 0.2);
        border-radius: 50%;
        filter: blur(30px);
        z-index: 0;
        opacity: 0;
        transition: opacity 0.4s;
      }
      .pulse {
        opacity: 1;
        animation: pulse-bg 2s ease-in-out infinite;
      }
      .main-icon {
        z-index: 1;
        --mdc-icon-size: 80px;
      }
      .icon-active {
        color: #60a5fa;
      }
      .icon-inactive {
        color: #475569;
      }
      .spin-ring {
        position: absolute;
        --mdc-icon-size: 110px;
        color: rgba(59, 130, 246, 0.1);
      }
      .rotating {
        animation: rotating 3s linear infinite;
      }
      .status-wrap {
        margin-top: 24px;
        text-align: center;
      }
      .state-badge {
        padding: 4px 16px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .badge-on {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
      }
      .badge-off {
        background: rgba(51, 65, 85, 1);
        color: #94a3b8;
      }
      .time-display {
        font-size: 36px;
        font-weight: 200;
        color: white;
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .time-icon {
        --mdc-icon-size: 24px;
        color: #64748b;
      }

      /* Progress */
      .progress-section {
        padding: 0 32px 16px;
      }
      .progress-label {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #94a3b8;
        margin-bottom: 8px;
        font-weight: 800;
        letter-spacing: 1px;
      }
      .progress-track {
        height: 8px;
        width: 100%;
        background: #1e293b;
        border-radius: 9999px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2563eb, #22d3ee);
        border-radius: 9999px;
        transition: width 1s ease-out;
        box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
      }

      /* Info */
      .info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 8px 24px;
      }
      .info-item {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 1rem;
        padding: 12px 4px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .info-icon {
        --mdc-icon-size: 16px;
      }
      .info-label {
        font-size: 9px;
        color: #94a3b8;
        font-weight: 400;
        text-transform: uppercase;
      }
      .info-value {
        font-size: 12px;
        color: white;
        font-weight: 500;
        text-align: center;
      }
      .course-value {
        font-size: 10px;
      }

      /* Off state */
      .washer-off .visual {
        opacity: 0.45;
        filter: grayscale(0.6);
        pointer-events: none;
      }
      .washer-off .progress-section {
        opacity: 0.3;
      }
      .washer-off .info-grid {
        opacity: 0.3;
      }
      .washer-off .controls .ctrl-btn:not(.ctrl-disabled) {
        opacity: 0.35;
        pointer-events: none;
      }

      /* Course selector */
      .course-selector-section {
        padding: 0 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .course-selector-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #94a3b8;
        text-transform: uppercase;
      }
      .course-selector-icon {
        --mdc-icon-size: 14px;
        color: #94a3b8;
      }
      .course-select {
        width: 100%;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.875rem;
        color: white;
        font-size: 13px;
        font-weight: 500;
        padding: 10px 14px;
        cursor: pointer;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 36px;
        transition: border-color 0.2s;
      }
      .course-select:focus {
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
      .course-select:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .course-select option {
        background: #1e293b;
        color: white;
      }

      /* Controls */
      .controls {
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 16px 0 24px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
      }
      .ctrl-btn {
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 0;
        color: inherit;
      }
      .ctrl-disabled {
        opacity: 0.4;
        cursor: default;
      }
      .ctrl-icon-wrap {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
      }
      .ctrl-icon-wrap ha-icon {
        --mdc-icon-size: 24px;
      }
      .ctrl-icon-primary {
        width: 56px;
        height: 56px;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
      }
      .ctrl-icon-primary ha-icon {
        --mdc-icon-size: 28px;
      }
      .ctrl-label {
        font-size: 10px;
        color: #94a3b8;
        font-weight: bold;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .ctrl-label-primary {
        color: #60a5fa;
      }

      /* Animations */
      @keyframes rotating {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse-bg {
        0%   { transform: scale(0.95); opacity: 0.5; }
        50%  { transform: scale(1.05); opacity: 0.8; }
        100% { transform: scale(0.95); opacity: 0.5; }
      }
    `;
  }
}

customElements.define("lg-washer-card", LgWasherCard);

class LgWasherMiniCard extends LgWasherCard {
  getCardSize() {
    return 3;
  }

  render() {
    if (!this._config || !this.hass) return html``;

    const isOn = this._isOn;
    const progress = this._progress;
    const remainTime = this._remainTime;
    const runState = this._runState;
    const name = this._config.name || "Lavadora";
    const model = this._config.model || "";
    const courseEntity = this._entity("course_entity");
    const spinEntity = this._entity("spin_entity");
    const courseSelectEntity = this._entity("course_select");
    const courseOptions = courseSelectEntity?.attributes?.options || [];
    const selectedCourse = courseSelectEntity?.state || "";

    return html`
      <ha-card class="mini-card-shell">
        <div class="mini-card ${isOn ? "" : "washer-off"}">
          <button
            class="mini-power-btn ${isOn ? "power-on" : "power-off"}"
            @click=${this._togglePower}
            title="Ligar/Desligar"
          >
            <ha-icon icon="mdi:power"></ha-icon>
          </button>

          <div class="mini-top" @click=${this._showMoreInfo}>
            <div class="mini-icon-wrap ${isOn ? "icon-on" : ""}">
              <div class="icon-blur ${isOn ? "pulse" : ""}"></div>
              <ha-icon
                icon="mdi:washing-machine"
                class="mini-main-icon ${isOn ? "icon-active" : "icon-inactive"}"
              ></ha-icon>
              <ha-icon
                icon="mdi:sync"
                class="mini-spin-ring ${isOn ? "rotating" : ""}"
              ></ha-icon>
            </div>

            <div class="mini-summary">
              <div class="mini-name">${name}</div>
              <div class="mini-model">${model}</div>
              <span class="state-badge ${isOn ? "badge-on" : "badge-off"}">
                ${isOn ? runState : "PRONTA"}
              </span>
            </div>
          </div>

          <div class="mini-time-row">
            <div class="mini-time">
              <ha-icon icon="mdi:clock-outline" class="time-icon"></ha-icon>
              ${remainTime}
            </div>
            <div class="mini-progress-value">${progress}%</div>
          </div>

          <div class="progress-track mini-progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>

          <div class="mini-info">
            <div class="mini-info-item">
              <span class="mini-info-label">CICLO</span>
              <span class="mini-info-value">${courseEntity ? courseEntity.state : "-"}</span>
            </div>
            <div class="mini-info-item">
              <span class="mini-info-label">CENTRIF.</span>
              <span class="mini-info-value">${spinEntity ? spinEntity.state : "-"}</span>
            </div>
          </div>

          ${courseOptions.length > 0 ? html`
            <select
              class="course-select"
              .value=${selectedCourse}
              @change=${this._selectCourse}
              ?disabled=${isOn}
            >
              ${courseOptions.map((opt) => html`
                <option value=${opt} ?selected=${opt === selectedCourse}>${opt}</option>
              `)}
            </select>
          ` : ""}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return [
      LgWasherCard.styles,
      css`
        ha-card.mini-card-shell {
          border-radius: 1.75rem;
        }

        .mini-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px;
        }

        .mini-power-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          z-index: 2;
        }

        .mini-top {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-right: 44px;
          cursor: pointer;
        }

        .mini-icon-wrap {
          position: relative;
          flex: 0 0 auto;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          background: rgba(30, 41, 59, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mini-main-icon {
          z-index: 1;
          --mdc-icon-size: 34px;
        }

        .mini-spin-ring {
          position: absolute;
          --mdc-icon-size: 52px;
          color: rgba(59, 130, 246, 0.14);
        }

        .mini-summary {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }

        .mini-name {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.1;
        }

        .mini-model {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.2;
        }

        .mini-time-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mini-time {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 24px;
          font-weight: 300;
          letter-spacing: 0.02em;
        }

        .mini-progress-value {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 0.08em;
        }

        .mini-progress-track {
          height: 7px;
        }

        .mini-info {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .mini-info-item {
          min-width: 0;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mini-info-label {
          font-size: 9px;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .mini-info-value {
          font-size: 12px;
          color: white;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `,
    ];
  }
}

customElements.define("lg-washer-mini-card", LgWasherMiniCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lg-washer-card",
  name: "LG Washer Card",
  preview: true,
  description: "Card customizável para máquinas de lavar LG ThinQ com editor visual e integração nativa ao Home Assistant.",
});
window.customCards.push({
  type: "lg-washer-mini-card",
  name: "LG Washer Mini Card",
  preview: true,
  description: "Versão compacta do card da lavadora LG ThinQ com ações principais e status resumido.",
});

console.info(
  `%c LG-WASHER-CARD %c v${CARD_VERSION} `,
  "color: white; background: #2563eb; font-weight: 700;",
  "color: #2563eb; background: white; font-weight: 700;"
);
