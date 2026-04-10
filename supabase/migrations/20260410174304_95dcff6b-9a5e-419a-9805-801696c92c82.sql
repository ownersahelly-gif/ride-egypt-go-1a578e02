
UPDATE public.bookings SET scheduled_date = CURRENT_DATE WHERE id = 'd1a63f91-79a6-408f-8c90-748ab2d133d2';

UPDATE public.ride_instances SET ride_date = CURRENT_DATE WHERE shuttle_id = 'c1e97052-56ff-42ac-8a6a-557f077ce2bb' AND ride_date = '2026-04-12';
