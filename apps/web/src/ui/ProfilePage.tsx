import type { Profile } from "../api";
import { Button, Surface } from "./Primitives";

export function ProfilePage(props: { profile: Profile | null; showImportGuide: boolean; onToggleImportGuide: () => void; onOpenSetup?: (() => void) | undefined; onLogout?: (() => void) | undefined }) {
  const body = props.profile?.body;
  return <section className="profile-page" aria-labelledby="profile-page-title">
    <div className="profile-page-intro"><span className="dg-eyebrow">ACCOUNT SETTINGS</span><h2 id="profile-page-title">我的空间</h2><p className="dg-muted">管理你的身份、目标和本地数据。每项设置都只影响你自己的服务。</p></div>
    <div className="profile-settings-grid">
      <div className="profile-settings-main">
        <Surface className="profile-section">
          <div className="profile-section-heading"><div><span className="dg-eyebrow">IDENTITY</span><h3>账户与身份</h3></div><span className="dg-status-chip">本地账户</span></div>
          <div className="profile-setting-list">
            <SettingRow label="账户称呼" value={props.profile?.displayName ?? "未设置"} action="由本地账户管理" />
            <SettingRow label="时区" value={props.profile?.timezone ?? "未设置"} action="由本地账户管理" />
          </div>
        </Surface>
        <Surface className="profile-section">
          <div className="profile-section-heading"><div><span className="dg-eyebrow">GOALS</span><h3>目标与偏好</h3></div></div>
          <div className="profile-setting-list">
            <SettingRow label="身高" value={body?.heightCm == null ? "尚未设置" : `${body.heightCm} cm`} action="调整目标" onAction={props.onOpenSetup} />
            <SettingRow label="公式性别" value={formulaLabel(body?.sexForFormula)} action="调整目标" onAction={props.onOpenSetup} />
            <SettingRow label="活动水平" value={activityLabel(body?.activityLevel)} action="调整目标" onAction={props.onOpenSetup} />
          </div>
          <p className="profile-helper">目标会用于每日预算计算，不会改变已经保存的饮食快照。</p>
        </Surface>
        <Surface className="profile-section">
          <div className="profile-section-heading"><div><span className="dg-eyebrow">LOCAL DATA</span><h3>数据与备份</h3></div></div>
          <div className="profile-setting-list">
            <SettingRow label="食物目录" value="仅使用本地目录" action="查看食物目录导入说明" onAction={props.onToggleImportGuide} />
            <SettingRow label="备份位置" value="由服务端管理" action="查看备份说明" />
          </div>
          {props.showImportGuide ? <div className="profile-import-guide" role="note"><strong>受控离线导入</strong><p>请在服务端使用仓库中的 <code>tools/food-import</code> 导入受控 JSON 数据，再回到饮食页面搜索。</p><Button type="button" variant="tertiary" onClick={props.onToggleImportGuide}>收起导入说明</Button></div> : null}
        </Surface>
      </div>
      <aside className="profile-context-rail"><Surface className="profile-context-card"><span className="dg-eyebrow">DATA PRINCIPLE</span><h3>数据属于你</h3><p className="dg-muted">记录、快照和备份保存在你自己的服务中。食物搜索不会自动访问外部食品库。</p></Surface><Surface className="profile-danger-zone"><span className="dg-eyebrow">CAUTION</span><h3>危险操作</h3><p>退出当前设备上的会话。不会删除你的记录。</p><Button type="button" variant="destructive" onClick={props.onLogout}>退出此设备</Button></Surface></aside>
    </div>
  </section>;
}

function SettingRow(props: { label: string; value: string; action?: string; onAction?: (() => void) | undefined }) {
  return <div className="profile-setting-row"><div><strong>{props.label}</strong><span>{props.value}</span></div>{props.action ? <Button type="button" variant="tertiary" onClick={props.onAction} disabled={!props.onAction}>{props.action}</Button> : null}</div>;
}

function formulaLabel(value: string | null | undefined) { return value === "female" ? "女性" : value === "male" ? "男性" : value === "none" ? "不指定" : "尚未设置"; }
function activityLabel(value: string | null | undefined) { return value === "sedentary" ? "久坐" : value === "light" ? "轻度活动" : value === "moderate" ? "中度活动" : value === "high" ? "高活动" : value === "very_high" ? "极高活动" : "尚未设置"; }
