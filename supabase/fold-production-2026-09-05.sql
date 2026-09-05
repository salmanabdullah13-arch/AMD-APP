-- ── Painting folds into Production; the old Joinery wrapper retires (Salman,
-- 2 Sep 2026, built 5 Sep). Every production role lands on the Production
-- module, which scopes its rail by role. Idempotent.
update public.user_types set dashboard_node_id = 'production'
 where key in ('painting_lead', 'joinery_draftsman', 'joinery_cutting_list_team', 'joinery_veneer_pressing_team',
               'joinery_floor_supervisor', 'joinery_site_supervisor', 'joinery_team_leader');
