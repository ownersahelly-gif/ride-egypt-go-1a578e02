export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          boarded_at: string | null
          boarding_code: string | null
          created_at: string
          custom_dropoff_lat: number | null
          custom_dropoff_lng: number | null
          custom_dropoff_name: string | null
          custom_pickup_lat: number | null
          custom_pickup_lng: number | null
          custom_pickup_name: string | null
          driver_arrived_at: string | null
          dropoff_stop_id: string | null
          dropped_off_at: string | null
          id: string
          partner_fee: number
          payment_proof_url: string | null
          pickup_stop_id: string | null
          platform_fee: number
          route_id: string | null
          scheduled_date: string
          scheduled_time: string
          seats: number
          shuttle_id: string | null
          skip_refund_amount: number | null
          skipped_at: string | null
          status: string
          total_price: number
          trip_direction: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          boarded_at?: string | null
          boarding_code?: string | null
          created_at?: string
          custom_dropoff_lat?: number | null
          custom_dropoff_lng?: number | null
          custom_dropoff_name?: string | null
          custom_pickup_lat?: number | null
          custom_pickup_lng?: number | null
          custom_pickup_name?: string | null
          driver_arrived_at?: string | null
          dropoff_stop_id?: string | null
          dropped_off_at?: string | null
          id?: string
          partner_fee?: number
          payment_proof_url?: string | null
          pickup_stop_id?: string | null
          platform_fee?: number
          route_id?: string | null
          scheduled_date: string
          scheduled_time: string
          seats?: number
          shuttle_id?: string | null
          skip_refund_amount?: number | null
          skipped_at?: string | null
          status?: string
          total_price?: number
          trip_direction?: string
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          boarded_at?: string | null
          boarding_code?: string | null
          created_at?: string
          custom_dropoff_lat?: number | null
          custom_dropoff_lng?: number | null
          custom_dropoff_name?: string | null
          custom_pickup_lat?: number | null
          custom_pickup_lng?: number | null
          custom_pickup_name?: string | null
          driver_arrived_at?: string | null
          dropoff_stop_id?: string | null
          dropped_off_at?: string | null
          id?: string
          partner_fee?: number
          payment_proof_url?: string | null
          pickup_stop_id?: string | null
          platform_fee?: number
          route_id?: string | null
          scheduled_date?: string
          scheduled_time?: string
          seats?: number
          shuttle_id?: string | null
          skip_refund_amount?: number | null
          skipped_at?: string | null
          status?: string
          total_price?: number
          trip_direction?: string
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_dropoff_stop_id_fkey"
            columns: ["dropoff_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pickup_stop_id_fkey"
            columns: ["pickup_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shuttle_id_fkey"
            columns: ["shuttle_id"]
            isOneToOne: false
            referencedRelation: "shuttles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_purchases: {
        Row: {
          bundle_id: string | null
          created_at: string
          expires_at: string
          id: string
          payment_proof_url: string | null
          purchased_at: string
          rides_remaining: number
          rides_total: number
          route_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          payment_proof_url?: string | null
          purchased_at?: string
          rides_remaining?: number
          rides_total?: number
          route_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bundle_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payment_proof_url?: string | null
          purchased_at?: string
          rides_remaining?: number
          rides_total?: number
          route_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "ride_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_purchases_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      carpool_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          route_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          route_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          route_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carpool_messages_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "carpool_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      carpool_requests: {
        Row: {
          created_at: string
          dropoff_lat: number
          dropoff_lng: number
          dropoff_name: string
          id: string
          message: string | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          route_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dropoff_lat: number
          dropoff_lng: number
          dropoff_name: string
          id?: string
          message?: string | null
          pickup_lat: number
          pickup_lng: number
          pickup_name: string
          route_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dropoff_lat?: number
          dropoff_lng?: number
          dropoff_name?: string
          id?: string
          message?: string | null
          pickup_lat?: number
          pickup_lng?: number
          pickup_name?: string
          route_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carpool_requests_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "carpool_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      carpool_routes: {
        Row: {
          allow_car_swap: boolean
          available_seats: number
          created_at: string
          days_of_week: number[] | null
          departure_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          fuel_share_amount: number | null
          id: string
          is_daily: boolean
          notes: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          share_fuel: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_car_swap?: boolean
          available_seats?: number
          created_at?: string
          days_of_week?: number[] | null
          departure_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          fuel_share_amount?: number | null
          id?: string
          is_daily?: boolean
          notes?: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          share_fuel?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_car_swap?: boolean
          available_seats?: number
          created_at?: string
          days_of_week?: number[] | null
          departure_time?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          fuel_share_amount?: number | null
          id?: string
          is_daily?: boolean
          notes?: string | null
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          share_fuel?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carpool_verifications: {
        Row: {
          admin_notes: string | null
          car_license_url: string | null
          created_at: string
          driving_license_url: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          license_plate: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_model: string | null
        }
        Insert: {
          admin_notes?: string | null
          car_license_url?: string | null
          created_at?: string
          driving_license_url?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          license_plate?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_model?: string | null
        }
        Update: {
          admin_notes?: string | null
          car_license_url?: string | null
          created_at?: string
          driving_license_url?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          license_plate?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_model?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          car_license_url: string | null
          created_at: string
          criminal_record_url: string | null
          driving_license_url: string | null
          experience_years: number
          id: string
          id_back_url: string | null
          id_front_url: string | null
          license_number: string
          notes: string | null
          phone: string | null
          status: string
          uber_proof_url: string | null
          updated_at: string
          user_id: string
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
          was_uber_driver: boolean | null
        }
        Insert: {
          car_license_url?: string | null
          created_at?: string
          criminal_record_url?: string | null
          driving_license_url?: string | null
          experience_years?: number
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          license_number: string
          notes?: string | null
          phone?: string | null
          status?: string
          uber_proof_url?: string | null
          updated_at?: string
          user_id: string
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
          was_uber_driver?: boolean | null
        }
        Update: {
          car_license_url?: string | null
          created_at?: string
          criminal_record_url?: string | null
          driving_license_url?: string | null
          experience_years?: number
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          license_number?: string
          notes?: string | null
          phone?: string | null
          status?: string
          uber_proof_url?: string | null
          updated_at?: string
          user_id?: string
          vehicle_model?: string
          vehicle_plate?: string
          vehicle_year?: number
          was_uber_driver?: boolean | null
        }
        Relationships: []
      }
      driver_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          departure_time: string
          driver_id: string
          id: string
          is_active: boolean
          is_recurring: boolean
          min_passengers: number
          return_time: string | null
          route_id: string
          shuttle_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          departure_time: string
          driver_id: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          min_passengers?: number
          return_time?: string | null
          route_id: string
          shuttle_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          departure_time?: string
          driver_id?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          min_passengers?: number
          return_time?: string | null
          route_id?: string
          shuttle_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_schedules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_schedules_shuttle_id_fkey"
            columns: ["shuttle_id"]
            isOneToOne: false
            referencedRelation: "shuttles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_templates: {
        Row: {
          created_at: string
          factor: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          ride_count: number | null
          sort_order: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          factor?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          ride_count?: number | null
          sort_order?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          factor?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          ride_count?: number | null
          sort_order?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      partner_companies: {
        Row: {
          bank_details: string | null
          commission_percentage: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          referral_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_details?: string | null
          commission_percentage?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          referral_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_details?: string | null
          commission_percentage?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          referral_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_earnings: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          id: string
          partner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          partner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          referral_code_used: string
          referred_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          referral_code_used: string
          referred_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          referral_code_used?: string
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_route_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          estimated_duration_minutes: number
          id: string
          name_ar: string
          name_en: string
          origin_lat: number
          origin_lng: number
          origin_name: string
          partner_id: string
          price: number
          status: string
          stops_json: Json
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          estimated_duration_minutes?: number
          id?: string
          name_ar: string
          name_en: string
          origin_lat: number
          origin_lng: number
          origin_name: string
          partner_id: string
          price?: number
          status?: string
          stops_json?: Json
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          estimated_duration_minutes?: number
          id?: string
          name_ar?: string
          name_en?: string
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          partner_id?: string
          price?: number
          status?: string
          stops_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_route_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_earnings: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          driver_id: string | null
          driver_payment_status: string
          id: string
          payment_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          driver_id?: string | null
          driver_payment_status?: string
          id?: string
          payment_method?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          driver_id?: string | null
          driver_payment_status?: string
          id?: string
          payment_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          referred_by_partner_id: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
          wallet_balance: number
        }
        Insert: {
          accepted_terms_at?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          referred_by_partner_id?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
          wallet_balance?: number
        }
        Update: {
          accepted_terms_at?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          referred_by_partner_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_partner_id_fkey"
            columns: ["referred_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          driver_id: string | null
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string
          refund_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          refund_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          refund_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_bundles: {
        Row: {
          bundle_type: string
          created_at: string
          discount_percentage: number
          id: string
          is_active: boolean
          price: number
          ride_count: number
          route_id: string
          updated_at: string
        }
        Insert: {
          bundle_type?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          price?: number
          ride_count?: number
          route_id: string
          updated_at?: string
        }
        Update: {
          bundle_type?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          price?: number
          ride_count?: number
          route_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_bundles_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_instances: {
        Row: {
          available_seats: number
          created_at: string
          departure_time: string
          direction: string
          driver_id: string
          id: string
          ride_date: string
          route_id: string
          schedule_id: string | null
          shuttle_id: string
          status: string
          total_seats: number
          updated_at: string
        }
        Insert: {
          available_seats?: number
          created_at?: string
          departure_time: string
          direction?: string
          driver_id: string
          id?: string
          ride_date: string
          route_id: string
          schedule_id?: string | null
          shuttle_id: string
          status?: string
          total_seats?: number
          updated_at?: string
        }
        Update: {
          available_seats?: number
          created_at?: string
          departure_time?: string
          direction?: string
          driver_id?: string
          id?: string
          ride_date?: string
          route_id?: string
          schedule_id?: string | null
          shuttle_id?: string
          status?: string
          total_seats?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_instances_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_instances_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "driver_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_instances_shuttle_id_fkey"
            columns: ["shuttle_id"]
            isOneToOne: false
            referencedRelation: "shuttles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_messages: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      route_package_overrides: {
        Row: {
          created_at: string
          factor_override: number
          id: string
          package_template_id: string
          route_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor_override: number
          id?: string
          package_template_id: string
          route_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor_override?: number
          id?: string
          package_template_id?: string
          route_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_package_overrides_package_template_id_fkey"
            columns: ["package_template_id"]
            isOneToOne: false
            referencedRelation: "package_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_package_overrides_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_requests: {
        Row: {
          created_at: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          id: string
          origin_lat: number
          origin_lng: number
          origin_name: string
          preferred_days: number[] | null
          preferred_time: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          id?: string
          origin_lat: number
          origin_lng: number
          origin_name: string
          preferred_days?: number[] | null
          preferred_time?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          id?: string
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          preferred_days?: number[] | null
          preferred_time?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          destination_lat: number
          destination_lng: number
          destination_name_ar: string
          destination_name_en: string
          estimated_duration_minutes: number
          id: string
          name_ar: string
          name_en: string
          origin_lat: number
          origin_lng: number
          origin_name_ar: string
          origin_name_en: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          destination_lat: number
          destination_lng: number
          destination_name_ar: string
          destination_name_en: string
          estimated_duration_minutes?: number
          id?: string
          name_ar: string
          name_en: string
          origin_lat: number
          origin_lng: number
          origin_name_ar: string
          origin_name_en: string
          price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          destination_lat?: number
          destination_lng?: number
          destination_name_ar?: string
          destination_name_en?: string
          estimated_duration_minutes?: number
          id?: string
          name_ar?: string
          name_en?: string
          origin_lat?: number
          origin_lng?: number
          origin_name_ar?: string
          origin_name_en?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          created_at: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_name: string | null
          id: string
          label: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_name: string | null
          route_id: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name?: string | null
          id?: string
          label?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          route_id: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name?: string | null
          id?: string
          label?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          route_id?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      shuttle_schedules: {
        Row: {
          arrival_time: string
          created_at: string
          day_of_week: number
          departure_time: string
          id: string
          shuttle_id: string
        }
        Insert: {
          arrival_time: string
          created_at?: string
          day_of_week: number
          departure_time: string
          id?: string
          shuttle_id: string
        }
        Update: {
          arrival_time?: string
          created_at?: string
          day_of_week?: number
          departure_time?: string
          id?: string
          shuttle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shuttle_schedules_shuttle_id_fkey"
            columns: ["shuttle_id"]
            isOneToOne: false
            referencedRelation: "shuttles"
            referencedColumns: ["id"]
          },
        ]
      }
      shuttles: {
        Row: {
          capacity: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          driver_id: string | null
          id: string
          route_id: string | null
          status: string
          updated_at: string
          vehicle_model: string
          vehicle_plate: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          driver_id?: string | null
          id?: string
          route_id?: string | null
          status?: string
          updated_at?: string
          vehicle_model: string
          vehicle_plate: string
        }
        Update: {
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          driver_id?: string | null
          id?: string
          route_id?: string | null
          status?: string
          updated_at?: string
          vehicle_model?: string
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "shuttles_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          arrival_time: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          name_ar: string
          name_en: string
          route_id: string
          stop_order: number
          stop_type: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          name_ar: string
          name_en: string
          route_id: string
          stop_order?: number
          stop_type?: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name_ar?: string
          name_en?: string
          route_id?: string
          stop_order?: number
          stop_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      time_based_pricing_rules: {
        Row: {
          created_at: string
          day_of_week: number[] | null
          end_time: string | null
          factor: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          route_id: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number[] | null
          end_time?: string | null
          factor?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          route_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number[] | null
          end_time?: string | null
          factor?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          route_id?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_based_pricing_rules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      user_type: "customer" | "driver" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      user_type: ["customer", "driver", "admin"],
    },
  },
} as const
