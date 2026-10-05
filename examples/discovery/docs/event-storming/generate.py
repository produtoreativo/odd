from __future__ import annotations

import os
import textwrap
from dataclasses import dataclass

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = os.path.dirname(__file__)

RED = "#FF0000"
BLUE = "#305CDE"
BLACK = "#111111"
GRAY = "#666666"
WHITE = "#FFFFFF"
AREA = "#F4F6FA"
ALT_AREA = "#F7FAFF"
TOUCH_POINT = "#F7F7F7"
ORANGE = "#E28A00"
YELLOW = "#D6B800"


@dataclass(frozen=True)
class Step:
    touch_point: str
    protagonist: str
    supporting: tuple[str, ...] = ()
    area: str = "Value Stream"
    detail: str = ""


@dataclass(frozen=True)
class Alternative:
    title: str
    steps: tuple[Step, ...]
    from_index: int
    to_index: int | None = None
    label: str = "alt"
    full_route: tuple[str, ...] = ()


@dataclass(frozen=True)
class Diagram:
    filename: str
    title: str
    transaction: str
    steps: tuple[Step, ...]
    alternatives: tuple[Alternative, ...] = ()


def wrapped(text: str, width: int) -> str:
    return "\n".join(textwrap.wrap(text, width=width, break_long_words=False))


def make_figure(width: float, height: float):
    fig, ax = plt.subplots(figsize=(width, height))
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.axis("off")
    fig.patch.set_facecolor(WHITE)
    return fig, ax


def draw_area(ax, x: float, y: float, width: float, height: float, label: str, face: str = AREA):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            width,
            height,
            boxstyle="round,pad=0.08",
            linewidth=1,
            edgecolor="#B8B8B8",
            facecolor=face,
            zorder=0,
        )
    )
    ax.text(x + 0.15, y + height - 0.22, label, fontsize=8.8, fontweight="bold", color=BLACK, va="top")


def draw_touch_point(ax, x: float, y: float, width: float, label: str, edge: str = ORANGE):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            width,
            0.85,
            boxstyle="round,pad=0.08",
            linewidth=1.2,
            edgecolor=edge,
            facecolor=TOUCH_POINT,
            zorder=2,
        )
    )
    ax.text(x + width / 2, y + 0.425, wrapped(label, 18), ha="center", va="center", fontsize=8.2, fontweight="bold")


def draw_event(ax, x: float, y: float, label: str, color: str, font_size: float = 8.3, width: int = 18):
    ax.text(x, y, wrapped(label, width), ha="center", va="center", fontsize=font_size, fontweight="bold", color=color, zorder=4)


def draw_detail(ax, x: float, y: float, label: str):
    if label:
        ax.text(x, y, wrapped(label, 22), ha="center", va="center", fontsize=6.2, color=GRAY, zorder=3)


def draw_arrow(ax, x1: float, y1: float, x2: float, y2: float, dashed: bool = False, label: str = ""):
    ax.annotate(
        "",
        xy=(x2, y2),
        xytext=(x1, y1),
        arrowprops={
            "arrowstyle": "->",
            "color": BLACK,
            "lw": 1.05,
            "linestyle": (0, (3, 3)) if dashed else "solid",
            "shrinkA": 2,
            "shrinkB": 2,
        },
        zorder=1,
    )
    if label:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.15, label, fontsize=6.7, color=GRAY, ha="center", style="italic")


def draw_legend(ax, x: float, y: float, steps: tuple[Step, ...], alternatives: tuple[Alternative, ...]):
    ax.text(x, y, "Caminho Feliz:", fontsize=8.2, color=BLACK, va="top")
    cursor = y - 0.45
    for step in steps:
        ax.text(x, cursor, step.protagonist, fontsize=6.8, color=RED, fontweight="bold", va="top")
        cursor -= 0.34

    for alt in alternatives:
        cursor -= 0.38
        ax.text(x, cursor, f"Caminho Alternativo: {alt.title}", fontsize=7.8, color=BLACK, va="top")
        cursor -= 0.42
        for item in alt.full_route or tuple(step.protagonist for step in alt.steps):
            ax.text(x, cursor, item, fontsize=6.5, color=RED, fontweight="bold", va="top")
            cursor -= 0.32


def draw_grouped_areas(ax, steps: tuple[Step, ...], xs: list[float], box_width: float, y: float, height: float):
    groups: list[tuple[str, int, int]] = []
    start = 0
    current = steps[0].area
    for index, step in enumerate(steps[1:], start=1):
        if step.area != current:
            groups.append((current, start, index - 1))
            start = index
            current = step.area
    groups.append((current, start, len(steps) - 1))

    for label, first, last in groups:
        x = xs[first] - 0.32
        width = xs[last] + box_width + 0.32 - x
        draw_area(ax, x, y, width, height, label)


def draw_diagram(diagram: Diagram):
    count = len(diagram.steps)
    box_width = 2.25 if count > 7 else 2.5
    gap = 0.55 if count > 7 else 0.72
    left = 4.2
    width = left + 0.8 + count * box_width + (count - 1) * gap
    height = 13.0 if diagram.alternatives else 8.6

    fig, ax = make_figure(width, height)
    ax.text(0.35, height - 0.35, diagram.title, fontsize=13, fontweight="bold", color=BLACK, va="top")
    ax.text(0.35, height - 0.9, f"Transacao: {diagram.transaction}", fontsize=7.8, color=GRAY, va="top")

    xs = [left + index * (box_width + gap) for index in range(count)]
    main_y = 5.45 if diagram.alternatives else 1.05
    tp_y = main_y + 2.55
    supporting_y = main_y + 1.88
    protagonist_y = main_y + 1.02
    detail_y = main_y + 0.36

    draw_grouped_areas(ax, diagram.steps, xs, box_width, main_y, 4.45)

    for index, step in enumerate(diagram.steps):
        x = xs[index]
        cx = x + box_width / 2
        draw_touch_point(ax, x, tp_y, box_width, step.touch_point, edge=YELLOW if index == count - 1 else ORANGE)
        if step.supporting:
            draw_event(ax, cx, supporting_y, " / ".join(step.supporting), BLUE, font_size=7.2, width=20)
        draw_event(ax, cx, protagonist_y, step.protagonist, RED, font_size=8.0, width=19)
        draw_detail(ax, cx, detail_y, step.detail)
        if index < count - 1:
            next_x = xs[index + 1]
            draw_arrow(ax, x + box_width, tp_y + 0.42, next_x, tp_y + 0.42)
            draw_arrow(ax, cx + box_width / 2, protagonist_y, next_x + box_width / 2 - box_width / 2, protagonist_y)

    draw_legend(ax, 0.35, height - 1.45, diagram.steps, diagram.alternatives)

    alt_top = 3.15
    for alt_index, alt in enumerate(diagram.alternatives):
        branch_y = alt_top - alt_index * 2.55
        branch_y = max(branch_y, 0.45)
        source_x = xs[min(max(alt.from_index, 0), count - 1)] + box_width / 2
        branch_width = max(5.7, len(alt.steps) * 2.7)
        area_x = min(max(left - 0.35, source_x - branch_width / 2), width - branch_width - 0.5)
        draw_area(ax, area_x, branch_y - 0.18, branch_width, 2.12, f"Caminho Alternativo: {alt.title}", face=ALT_AREA)
        alt_xs = [area_x + 0.35 + index * 2.7 for index in range(len(alt.steps))]

        for index, step in enumerate(alt.steps):
            x = alt_xs[index]
            cx = x + 1.1
            draw_touch_point(ax, x, branch_y + 0.45, 2.2, step.touch_point, edge=ORANGE)
            if step.supporting:
                draw_event(ax, cx, branch_y + 0.16, " / ".join(step.supporting), BLUE, font_size=6.5, width=18)
            draw_event(ax, cx, branch_y - 0.12, step.protagonist, RED, font_size=6.9, width=18)
            if index < len(alt.steps) - 1:
                draw_arrow(ax, x + 2.2, branch_y + 0.86, alt_xs[index + 1], branch_y + 0.86)

        draw_arrow(ax, source_x, protagonist_y - 0.15, alt_xs[0] + 1.1, branch_y + 1.08, dashed=True, label=alt.label)
        if alt.to_index is not None:
            target_x = xs[min(max(alt.to_index, 0), count - 1)] + box_width / 2
            draw_arrow(ax, alt_xs[-1] + 1.1, branch_y - 0.1, target_x, protagonist_y - 0.15, dashed=True, label="retorno")

    fig.savefig(os.path.join(OUT, diagram.filename), dpi=150, bbox_inches="tight", facecolor=WHITE)
    plt.close(fig)


def diagrams() -> tuple[Diagram, ...]:
    return (
        Diagram(
            filename="vs-01-certificacao-de-aluno.png",
            title="VS-01 — Certificacao de Aluno",
            transaction="Visitante descobre curso -> aluno recebe credencial verificavel e compartilhavel.",
            steps=(
                Step("Home / Catalogo", "Interesse Gerado", ("Cursos Descobertos",), "Descoberta", "GET /, GET /courses"),
                Step("Detalhe do Curso", "Intencao de Compra Registrada", ("Curso Visualizado",), "Descoberta", "GET /courses/:id"),
                Step("Cadastro de Conta", "Perfil Criado", ("Email Informado",), "Acesso e Identidade", "POST /auth/signup"),
                Step("Definicao de Senha", "Senha Definida", ("Link de Reset Recebido",), "Acesso e Identidade", "async: email"),
                Step("Login", "JWT Emitido", ("Credenciais Validadas",), "Acesso e Identidade", "POST /auth/login"),
                Step("Inscricao Admin", "Aluno Inscrito", ("Perfil Localizado",), "Operacao Admin", "POST /enrollments"),
                Step("Compartilhar Drive", "Drive Compartilhado", ("Email Google Validado",), "Operacao Admin", "Google Drive API"),
                Step("Emitir Credencial", "Credencial Emitida", ("Badge Localizado",), "Certificacao", "POST /credential"),
                Step("Privacidade", "Credencial Publicada", ("Credencial Visualizada",), "Certificacao", "PATCH /privacy"),
                Step("LinkedIn", "Credencial Compartilhada", ("URL Publica Gerada",), "Visibilidade", "Redirect LinkedIn"),
            ),
            alternatives=(
                Alternative(
                    "Email ja cadastrado",
                    (Step("Cadastro de Conta", "Conta Nao Criada", ("Email Duplicado Detectado",)),),
                    from_index=2,
                    label="alt: email duplicado",
                    full_route=("Interesse Gerado", "Intencao de Compra Registrada", "Conta Nao Criada"),
                ),
            ),
        ),
        Diagram(
            filename="vs-02-gestao-operacional-de-cursos.png",
            title="VS-02 — Gestao Operacional de Cursos",
            transaction="Admin cria curso, gerencia turma, inscreve aluno e emite credencial.",
            steps=(
                Step("Painel Admin", "Cursos Consultados", ("Cursos Listados",), "Configuracao de Cursos", "GET /admin"),
                Step("Formulario de Curso", "Curso Criado", ("Badge Associado",), "Configuracao de Cursos", "POST /admin/courses"),
                Step("Formulario de Turma", "Turma Criada", ("Datas e Capacidade Definidas",), "Gestao de Turmas", "POST /classes"),
                Step("Lista de Turmas", "Turmas Monitoradas", ("Inscritos Contabilizados",), "Gestao de Turmas", "GET /classes"),
                Step("Lista de Inscritos", "Inscritos Consultados", ("Status Carregado",), "Inscricoes", "GET /enrollments"),
                Step("Inscrever Aluno", "Aluno Inscrito", ("Email Confirmado",), "Inscricoes", "POST /enrollments"),
                Step("Compartilhar Drive", "Drive Compartilhado", ("Email Drive Validado",), "Certificacao", "Google Drive API"),
                Step("Emitir Credencial", "Credencial Emitida", ("Badge Encontrado",), "Certificacao", "POST /credential"),
            ),
            alternatives=(
                Alternative("Cancelar inscricao", (Step("Cancelar Inscricao", "Inscricao Cancelada", ("Turma Ativa Validada",)),), 5, label="alt: cancelar", full_route=("Cursos Consultados", "Curso Criado", "Turma Criada", "Inscritos Consultados", "Inscricao Cancelada")),
                Alternative("Turma encerrada", (Step("Validacao da Turma", "Cancelamento Bloqueado", ("Turma Encerrada Detectada",)),), 5, label="alt: encerrada", full_route=("Cursos Consultados", "Curso Criado", "Turma Criada", "Inscritos Consultados", "Cancelamento Bloqueado")),
            ),
        ),
        Diagram(
            filename="vs-03-descoberta-e-engajamento.png",
            title="VS-03 — Descoberta e Engajamento",
            transaction="Visitante compreende a trilha ProdOps e converte para aluno.",
            steps=(
                Step("Home", "Intencao Identificada", ("Trilha Visualizada",), "Descoberta", "GET /"),
                Step("Catalogo de Cursos", "Curso Selecionado", ("Cursos Listados",), "Descoberta", "GET /courses"),
                Step("Detalhe do Curso", "Interesse Confirmado", ("Conteudo Explorado",), "Descoberta", "GET /courses/:id"),
                Step("Badges", "Badge Escolhido", ("Competencias Lidas",), "Conversao", "GET /badges"),
                Step("Documentacao", "Framework Compreendido", ("Jornadas Acessadas",), "Conversao", "GET /docs"),
                Step("Inscricao", "Turma Selecionada", ("Turmas Carregadas",), "Conversao", "Turmas abertas"),
                Step("Cadastro / Login", "Visitante Convertido", ("Email Informado",), "Conversao", "VS-01"),
            ),
            alternatives=(
                Alternative("Visitante nao autenticado", (Step("Login / Cadastro", "Redirecionado para Login", ("Visitante Nao Autenticado",)),), 5, to_index=6, label="alt: sem login", full_route=("Intencao Identificada", "Curso Selecionado", "Interesse Confirmado", "Turma Selecionada", "Redirecionado para Login", "Visitante Convertido")),
            ),
        ),
        Diagram(
            filename="vs-04-gestao-do-perfil.png",
            title="VS-04 — Gestao do Perfil do Aluno",
            transaction="Aluno atualiza perfil para manter credenciais e compartilhamento corretos.",
            steps=(
                Step("Pagina de Perfil", "Perfil Carregado", ("Endereco Carregado",), "Dados Pessoais", "GET /auth/profile"),
                Step("Dados Pessoais", "Perfil Atualizado", ("Campos Preenchidos",), "Dados Pessoais", "PATCH /profiles/:id"),
                Step("Email Google", "Google Email Salvo", ("Email Google Informado",), "Dados Pessoais", "Drive/Meet"),
                Step("Upload de Foto", "Foto de Perfil Atualizada", ("Magic Bytes Validados",), "Foto e Endereco", "POST /profiles/photo"),
                Step("Endereco", "Endereco Preenchido", ("CEP Consultado",), "Foto e Endereco", "ViaCEP"),
                Step("Salvar Endereco", "Endereco Salvo", ("Dados Validados",), "Foto e Endereco", "PUT /profiles/address"),
            ),
            alternatives=(
                Alternative("Arquivo invalido", (Step("Validacao de Arquivo", "Upload de Foto Rejeitado", ("MIME ou Tamanho Invalido",)),), 3, label="alt: arquivo invalido", full_route=("Perfil Carregado", "Perfil Atualizado", "Google Email Salvo", "Upload de Foto Rejeitado")),
                Alternative("IDOR bloqueado", (Step("Autorizacao de Perfil", "Acesso Indevido Bloqueado", ("ID Incompativel Detectado",)),), 1, label="alt: IDOR", full_route=("Perfil Carregado", "Acesso Indevido Bloqueado")),
            ),
        ),
        Diagram(
            filename="vs-05-recuperacao-de-acesso.png",
            title="VS-05 — Recuperacao de Acesso",
            transaction="Aluno solicita reset, recebe email assincrono e redefine a senha.",
            steps=(
                Step("Form. Recuperacao", "Solicitacao de Reset Recebida", ("Email Informado",), "Solicitacao de Reset", "GET /auth/recovery"),
                Step("Geracao de Token", "Token de Reset Gerado", ("Perfil Localizado",), "Solicitacao de Reset", "POST /auth/recovery"),
                Step("Canal de Email", "Solicitacao Publicada", ("Email de Reset Enviado",), "Async OneSignal", "async: OneSignal"),
                Step("Link do Email", "Token Aceito", ("Token Validado",), "Redefinicao de Senha", "/password-reset/:token"),
                Step("Nova Senha", "Senha Redefinida", ("Hash Bcrypt Gerado",), "Redefinicao de Senha", "POST /auth/reset"),
                Step("Login", "Acesso Recuperado", ("Credenciais Atualizadas",), "Redefinicao de Senha", "POST /auth/login"),
            ),
            alternatives=(
                Alternative("Email nao cadastrado", (Step("Form. Recuperacao", "Recuperacao Negada", ("Email Nao Localizado",)),), 0, label="alt: email inexistente", full_route=("Solicitacao de Reset Recebida", "Recuperacao Negada")),
                Alternative("Token expirado ou invalido", (Step("Validacao de Token", "Reset Negado", ("Token Expirado Detectado",)),), 3, label="alt: token expirado", full_route=("Solicitacao de Reset Recebida", "Token de Reset Gerado", "Solicitacao Publicada", "Reset Negado")),
            ),
        ),
    )


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for diagram in diagrams():
        draw_diagram(diagram)
        print(f"generated {diagram.filename}")


if __name__ == "__main__":
    main()
