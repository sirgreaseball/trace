-- Rebuild the demo teams every six hours, so visitors always find them intact.
create extension if not exists pg_cron;
select cron.schedule('reset-demo', '0 */6 * * *', 'select public.reset_demo()');
