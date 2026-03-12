import { DashboardPlan } from '../../shared/types.js';

export function buildDatadogDashboardTerraform(plan: DashboardPlan): Record<string, unknown> {
  const widgets: Array<Record<string, unknown>> = [];

  widgets.push({
    definition: {
      type: 'note',
      content: `Gerado automaticamente a partir de Event Storming. Dashboard: ${plan.dashboardTitle}`,
      background_color: 'white',
      font_size: '14',
      text_align: 'left',
      show_tick: false,
      tick_edge: 'left',
      tick_pos: '50%'
    }
  });

  for (const group of plan.groups) {
    widgets.push({
      definition: {
        type: 'note',
        content: `Stage: ${group.title}`,
        background_color: 'blue',
        font_size: '16',
        text_align: 'left',
        show_tick: false,
        tick_edge: 'left',
        tick_pos: '50%'
      }
    });

    for (const widget of group.widgets) {
      widgets.push({
        definition: {
          type: 'event_stream',
          title: widget.title,
          query: widget.query || `tags:(event_key:${widget.id} source:odd)`,
          event_size: 'l'
        }
      });
    }
  }

  const dashboard = {
    title: plan.dashboardTitle,
    description: 'Generated from Event Storming spreadsheet by planner agent',
    layout_type: 'ordered',
    widgets,
    template_variables: []
  };

  return {
    resource: {
      datadog_dashboard_json: {
        event_storming_dashboard: {
          dashboard: JSON.stringify(dashboard)
        }
      }
    }
  };
}
