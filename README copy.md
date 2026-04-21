# LG Washer Card

Card customizável para máquinas de lavar **LG ThinQ** no Home Assistant, com editor visual e animações.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/SEU_USUARIO/lg-washer-card.svg)](https://github.com/SEU_USUARIO/lg-washer-card/releases)

![preview](./assets/preview.png)

## Funcionalidades

- Indicador visual com animação de rotação quando em funcionamento
- Barra de progresso dinâmica baseada no tempo restante
- Exibição de temperatura, centrifugação e ciclo atual
- Botões de pausar e iniciar remotamente
- Editor visual para configuração sem YAML
- Compatível com qualquer integração LG ThinQ (SmartThinQ)

## Instalação via HACS

1. Acesse **HACS → Frontend → Explorar e baixar repositórios**
2. Pesquise por **LG Washer Card**
3. Clique em **Baixar**
4. Reinicie o Home Assistant
5. Adicione o card via Interface → Editar Painel → **+ Adicionar Card** → **LG Washer Card**

### Instalação Manual

1. Faça o download do arquivo `lg-washer-card.js` da [última release](https://github.com/SEU_USUARIO/lg-washer-card/releases)
2. Coloque em `config/www/lg-washer-card.js`
3. Adicione como recurso em **Configurações → Dashboards → Recursos**:
   ```
   /local/lg-washer-card.js
   ```

## Configuração

Use o **editor visual** ou configure via YAML:

```yaml
type: custom:lg-washer-card
name: Lavadora
model: LG VC4
brand: LG ThinQ
entity: sensor.lavadora
temp_entity: sensor.lavadora_water_temp
spin_entity: sensor.lavadora_spin_speed
course_entity: sensor.lavadora_current_course
power_switch: switch.lavadora_power
pause_button: button.lavadora_pause
start_button: button.lavadora_remote_start
```

| Opção | Descrição | Obrigatório |
|---|---|---|
| `entity` | Entidade principal da lavadora | ✅ |
| `name` | Nome exibido no card | ❌ |
| `model` | Modelo da máquina | ❌ |
| `brand` | Marca / subtítulo | ❌ |
| `temp_entity` | Sensor de temperatura da água | ❌ |
| `spin_entity` | Sensor de velocidade de centrifugação | ❌ |
| `course_entity` | Sensor do ciclo atual | ❌ |
| `power_switch` | Switch de energia | ❌ |
| `pause_button` | Botão de pausar | ❌ |
| `start_button` | Botão de iniciar remotamente | ❌ |

## Atributos Esperados na Entidade Principal

O card utiliza os seguintes atributos da entidade principal:

- `run_state` — estado de execução (ex: `LAVANDO`)
- `remain_time` — tempo restante (formato `H:MM:SS`)
- `initial_time` — tempo total do ciclo

## Licença

MIT
