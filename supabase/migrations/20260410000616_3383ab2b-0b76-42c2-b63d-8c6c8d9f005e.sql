
-- Trigger to auto-create a shuttle when a driver application is approved
CREATE OR REPLACE FUNCTION public.auto_create_shuttle_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if shuttle already exists for this driver
    IF NOT EXISTS (SELECT 1 FROM public.shuttles WHERE driver_id = NEW.user_id) THEN
      INSERT INTO public.shuttles (driver_id, vehicle_model, vehicle_plate, capacity, status)
      VALUES (
        NEW.user_id,
        NEW.vehicle_model,
        NEW.vehicle_plate,
        14,
        'active'
      );
    END IF;
    
    -- Also insert 'user' role if not exists
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'user') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'user');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_driver_application_approved
  AFTER UPDATE ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_shuttle_on_approval();
