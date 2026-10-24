"""本番アーキテクチャ図（docs/image/architecture.png）を生成するスクリプト。

README の「本番アーキテクチャ」に掲載する図の正本。構成を変えたときはこのファイルを
修正し、以下のコマンドで PNG を再生成してコミットする。

    python -m venv scripts/.venv
    scripts/.venv/Scripts/python -m pip install -r scripts/requirements.txt  # Windows
    scripts/.venv/Scripts/python scripts/architecture_diagram.py

前提:
    - Graphviz（dot コマンド）がインストール済みで PATH が通っていること
    - フォント Noto Sans JP がインストール済みであること
      （https://fonts.google.com/noto/specimen/Noto+Sans+JP。未インストールの場合はエラー終了する）
    - scripts/requirements.txt の依存がインストール済みであること
"""

import subprocess
import sys
from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import EC2, ECS
from diagrams.aws.integration import SNS
from diagrams.aws.management import CloudwatchAlarm
from diagrams.aws.network import CloudFront, Route53
from diagrams.aws.security import Cognito
from diagrams.aws.storage import S3
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.client import User
from diagrams.onprem.database import PostgreSQL

# 出力先（拡張子なし。diagrams が .png を付与する）
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "docs" / "image" / "architecture"

# 日本語ラベルを描画するフォント。OS ごとに描画結果が変わらないよう、
# 全 OS で入手できる Noto Sans JP に固定する
FONT = "Noto Sans JP"

GRAPH_ATTR = {
    "fontname": FONT,
    "fontsize": "20",
    "pad": "0.5",
    "nodesep": "0.8",
    "ranksep": "1.2",
    "bgcolor": "white",
    # ortho だとエッジラベルが線から離れて読みにくいため曲線にする
    "splines": "spline",
}
NODE_ATTR = {"fontname": FONT, "fontsize": "13"}
EDGE_ATTR = {"fontname": FONT, "fontsize": "12"}


def assert_font_available(font: str) -> None:
    """Graphviz が指定フォントを解決できることを確認する。

    Graphviz はフォントが見つからないと警告なしで別フォントに置き換えるため、
    dot -v の解決結果にフォント名が含まれない場合はエラー終了する。

    Args:
        font: 確認するフォント名
    """
    # PNG 本体は不要だが、stdout にバイナリが出るため bytes のまま受けて捨てる
    result = subprocess.run(
        ["dot", "-v", "-Tpng"],
        input=f'digraph {{ node [fontname="{font}"]; a [label="あ"] }}'.encode(),
        capture_output=True,
        check=True,
    )
    stderr = result.stderr.decode("utf-8", errors="replace")
    resolved = next((line for line in stderr.splitlines() if "resolved to" in line), "")
    if f'"{font} ' not in resolved:
        sys.exit(f"フォント {font} が見つかりません（Graphviz の解決結果: {resolved or '不明'}）")


def main() -> None:
    """アーキテクチャ図を描画して PNG を出力する。"""
    assert_font_available(FONT)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with Diagram(
        # README の見出しと重複するため図中のタイトルは表示しない
        "",
        filename=str(OUTPUT_PATH),
        outformat="png",
        direction="LR",
        show=False,
        graph_attr=GRAPH_ATTR,
        node_attr=NODE_ATTR,
        edge_attr=EDGE_ATTR,
    ):
        user = User("ユーザー")
        route53 = Route53("Route 53")
        cloudfront = CloudFront("CloudFront")
        cf_functions = CloudFront("CloudFront Functions")
        s3 = S3("S3\n(静的アセット)")
        cognito = Cognito("Cognito")
        github_actions = GithubActions("GitHub Actions")

        with Cluster("EC2 t3.small", graph_attr={"fontname": FONT}):
            ec2 = EC2("EC2")
            nestjs = ECS("NestJS :3000\n(ECS タスク)")
            postgres = PostgreSQL("PostgreSQL 16")
            nestjs >> postgres

        with Cluster("監視・通知", graph_attr={"fontname": FONT}):
            alarm = CloudwatchAlarm("CloudWatch Alarm")
            sns = SNS("SNS")
            admin = User("管理者")
            alarm >> Edge(label="EC2 障害検知") >> sns
            sns >> Edge(label="メール通知") >> admin

        user >> route53 >> cloudfront
        cloudfront >> Edge(label="静的アセット") >> s3
        cloudfront >> Edge(label="/api/") >> nestjs
        cf_functions >> Edge(label="クローラーブロック", style="dashed") >> cloudfront
        cognito >> Edge(label="JWT 検証", style="dashed") >> nestjs
        alarm >> Edge(label="ステータス監視", style="dashed") >> ec2

        github_actions >> Edge(label="deploy") >> s3
        github_actions >> Edge(label="deploy") >> nestjs


if __name__ == "__main__":
    main()
