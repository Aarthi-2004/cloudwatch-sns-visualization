# Cloudwatch-sns-on-ec2-monitoring-cpu-utilization-projects-visual

**#BuildwithCloudmessenger**

> Educational simulation only. No live AWS resources are created or monitored.

## 1. Overview
An animated, interactive story that teaches **EC2 CPU utilization monitoring with Amazon CloudWatch and Amazon SNS**. Aarthi runs an online shop on EC2. As traffic grows, CPU rises; CloudWatch watches the metric, an alarm changes state, and SNS emails Aarthi. Built with plain HTML, CSS, JavaScript and inline SVG: no libraries, no build step, no AWS account.

## 2. Learning objectives
- Explain what EC2 `CPUUtilization` measures and how often it is reported.
- Describe how CloudWatch stores metrics and evaluates alarms.
- Configure threshold, period, comparison operator and evaluation periods (conceptually).
- Distinguish the alarm states `OK`, `ALARM` and `INSUFFICIENT_DATA`.
- Explain how an alarm action publishes to an SNS topic and how email subscriptions work.
- List common troubleshooting checks a Cloud Support Engineer would run.

## 3. AWS services explained
| Service | Story role | Purpose |
|---|---|---|
| Amazon EC2 | Aarthi's virtual computer | Runs the shopping website |
| Amazon CloudWatch | Monitoring officer | Stores metrics, draws graphs, evaluates alarms |
| Amazon SNS | Notification messenger | Delivers alarm messages to subscribed endpoints |

## 4. The nine learning steps
1. **EC2 Instance** – Aarthi launches his web server.
2. **CPU Metrics** – CPU utilization becomes measurable (basic monitoring ≈ 5 min; detailed ≈ 1 min, may cost extra).
3. **CloudWatch** – Metrics appear in the monitoring dashboard.
4. **Alarm Configuration** – Set a CPU threshold and evaluation period.
5. **Threshold Breach** – CPU usage rises above the threshold.
6. **Alarm State** – The alarm changes state.
7. **Amazon SNS** – The alarm triggers a configured notification action (topic `aarthi-ec2-cpu-alerts`).
8. **Email Alert** – Aarthi receives a simulated notification.
9. **Complete Architecture** – The whole workflow plus troubleshooting points.

## 5. Architecture flow
`EC2 Instance → CloudWatch Metrics → CloudWatch Alarm → Amazon SNS Topic → Email Subscription → Aarthi`

This design **detects and notifies**. It does not reduce CPU or repair the instance.

## 6. Moving-object legend
Metric packet (CPU reading to CloudWatch) · Alarm signal (state-change event) · Envelope (SNS email) · CPU gauge · Green check (normal / delivered) · Red warning (breach) · Gold dashed line (threshold) · Chart · Cloud icon. The in-app legend explains each in plain language.

## 7. Interactive controls
Play / Pause / Reset · step selection (click, or arrow keys inside the step list) · CPU slider and Normal / Moderate / High / Critical presets · threshold slider · alarm name, comparison, evaluation periods, period, sampling interval · Simulate alarm · Send test notification · Acknowledge alert · Recover server load · Stop sending metrics (shows `INSUFFICIENT_DATA`) · light/dark theme · motion toggle (also honours `prefers-reduced-motion`).

### Simulation rules (deterministic)
Each sample is added to a history. The alarm looks at the last **N** samples (N = evaluation periods):
- fewer than N samples, or any missing → `INSUFFICIENT_DATA`
- all N satisfy the comparison against the threshold → `ALARM`
- otherwise → `OK`

When the alarm enters `ALARM` at step 7 or later, the SNS flow runs: topic → email → inbox.

## 8. Prerequisites
A modern browser. For local serving: Python 3. Optional: Node.js to run `node --check js/app.js`.

## 9. Local setup
```bash
cd cloudwatch-sns-ec2-cpu-monitoring-visual
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## 10. GitHub repository setup
```bash
git init
git add .
git commit -m "Add CloudWatch + SNS EC2 CPU monitoring visual"
git branch -M main
git remote add origin https://github.com/<your-user>/Cloudwatch-sns-on-ec2-monitoring-cpu-utilization-projects-visual.git
git push -u origin main
```

## 11. GitHub Pages deployment
1. Push the project to GitHub (files at the repository root).
2. Repository **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Save and open `https://<your-user>.github.io/<repository-name>/` once it is published. The `.nojekyll` file stops Jekyll processing.

## 12. Folder structure
```
cloudwatch-sns-ec2-cpu-monitoring-visual/
├── index.html      page structure and the inline SVG diagram
├── css/style.css   themes, layout, responsive and reduced-motion rules
├── js/app.js       content, pure alarm logic, state, rendering, controls
├── .nojekyll
├── LICENSE         placeholder – see section 18
└── README.md
```

## 13. Customization guide
- Story text and step content: `STEPS` in `js/app.js`.
- Legend text: `LEGEND`. Presets: `PRESETS`. Scene CPU per step: `SCENE_CPU`.
- Default alarm settings: `DEFAULTS`.
- Colors and fonts: CSS variables at the top of `css/style.css`.
- Diagram layout: the `<svg>` in `index.html` (wires, then boxes, then packets).
- Alarm rules: `evaluate()` is a pure function; edit it to try other rules.

## 14. Technical accuracy notes and limitations
- Nothing contacts AWS. CPU values are simulated educational data.
- Real CloudWatch alarms also use a statistic (Average, Maximum…), a period, `DatapointsToAlarm` (M out of N), and missing-data treatment. This lab simplifies to "all N of the last N samples". The period dropdown only changes the label.
- Samples arrive every 1–3 real seconds, not every 1–5 real minutes.
- A real SNS email subscription must be **confirmed**, and the alarm needs an action for the chosen state. Only the `ALARM` action is simulated.
- High CPU does not by itself mean an instance is failing.
- The optional Google Fonts link loads Bricolage Grotesque; if offline, system fonts are used.

## 15. Suggested improvements for a real AWS implementation
Create the alarm in the console or with CloudFormation/Terraform; use `DatapointsToAlarm`; add an `OK` action; enable detailed monitoring where needed; add EC2 status-check alarms; add Auto Scaling or an automation runbook for remediation; use the CloudWatch agent for memory/disk metrics; restrict SNS topic policies.

## 16. Screenshots
_Placeholders – add your own:_
- `docs/screenshot-dark.png`
- `docs/screenshot-light.png`
- `docs/screenshot-mobile.png`

## 17. Accessibility
Semantic buttons, visible focus rings, `aria-live` announcements, labelled diagram, light and dark themes, reduced-motion support.

## 18. License
`LICENSE` is a **placeholder**. The EduBridge license terms were not provided, so none were invented. Replace the file with the verified license text before publishing.

**#BuildwithCloudmessenger**
