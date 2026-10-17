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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          percentual: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          percentual?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          percentual?: number
        }
        Relationships: []
      }
      ingredientes: {
        Row: {
          created_at: string | null
          custo_unitario: number
          estoque_minimo: number
          id: string
          nome: string
          quantidade: number
          unidade: string
          validade: string | null
        }
        Insert: {
          created_at?: string | null
          custo_unitario?: number
          estoque_minimo?: number
          id?: string
          nome: string
          quantidade?: number
          unidade?: string
          validade?: string | null
        }
        Update: {
          created_at?: string | null
          custo_unitario?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          quantidade?: number
          unidade?: string
          validade?: string | null
        }
        Relationships: []
      }
      loja_config: {
        Row: {
          aberta_manual: boolean | null
          abre: string
          fecha: string
          id: number
          som_alerta: boolean
          taxa_entrega: number
        }
        Insert: {
          aberta_manual?: boolean | null
          abre?: string
          fecha?: string
          id?: number
          som_alerta?: boolean
          taxa_entrega?: number
        }
        Update: {
          aberta_manual?: boolean | null
          abre?: string
          fecha?: string
          id?: number
          som_alerta?: boolean
          taxa_entrega?: number
        }
        Relationships: []
      }
      motoboys: {
        Row: {
          ativo: boolean
          created_at: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      pedidos_online: {
        Row: {
          cliente: string
          created_at: string
          cupom: string | null
          desconto: number
          endereco: string
          id: string
          itens: Json
          status: string
          subtotal: number
          taxa_entrega: number
          telefone: string
          token: string
          total: number
        }
        Insert: {
          cliente: string
          created_at?: string
          cupom?: string | null
          desconto?: number
          endereco: string
          id?: string
          itens: Json
          status?: string
          subtotal: number
          taxa_entrega?: number
          telefone: string
          token: string
          total: number
        }
        Update: {
          cliente?: string
          created_at?: string
          cupom?: string | null
          desconto?: number
          endereco?: string
          id?: string
          itens?: Json
          status?: string
          subtotal?: number
          taxa_entrega?: number
          telefone?: string
          token?: string
          total?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string | null
          descricao: string | null
          id: string
          imagem_path: string | null
          nome: string
          preco: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_path?: string | null
          nome: string
          preco?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_path?: string | null
          nome?: string
          preco?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      receitas: {
        Row: {
          id: string
          ingrediente_id: string
          produto_id: string
          quantidade: number
        }
        Insert: {
          id?: string
          ingrediente_id: string
          produto_id: string
          quantidade: number
        }
        Update: {
          id?: string
          ingrediente_id?: string
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
      venda_itens: {
        Row: {
          custo_unitario: number
          id: string
          nome: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          venda_id: string
        }
        Insert: {
          custo_unitario?: number
          id?: string
          nome: string
          preco_unitario: number
          produto_id?: string | null
          quantidade: number
          venda_id: string
        }
        Update: {
          custo_unitario?: number
          id?: string
          nome?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente: string | null
          created_at: string
          criado_por: string | null
          cupom: string | null
          custo: number
          desconto: number
          endereco: string | null
          id: string
          lucro: number
          motoboy_id: string | null
          numero: number
          status: string
          subtotal: number
          taxa_entrega: number
          telefone: string | null
          tipo: string
          total: number
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          criado_por?: string | null
          cupom?: string | null
          custo?: number
          desconto?: number
          endereco?: string | null
          id?: string
          lucro?: number
          motoboy_id?: string | null
          numero?: number
          status?: string
          subtotal?: number
          taxa_entrega?: number
          telefone?: string | null
          tipo?: string
          total?: number
        }
        Update: {
          cliente?: string | null
          created_at?: string
          criado_por?: string | null
          cupom?: string | null
          custo?: number
          desconto?: number
          endereco?: string | null
          id?: string
          lucro?: number
          motoboy_id?: string | null
          numero?: number
          status?: string
          subtotal?: number
          taxa_entrega?: number
          telefone?: string | null
          tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      catalogo_online: { Args: never; Returns: Json }
      consultar_pedido_online: { Args: { _token: string }; Returns: Json }
      criar_pedido_online: {
        Args: {
          _cliente: string
          _cupom?: string
          _endereco: string
          _itens: Json
          _telefone: string
          _token: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      registrar_venda: {
        Args: {
          _cliente?: string
          _cupom?: string
          _endereco?: string
          _itens: Json
          _telefone?: string
          _tipo?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "atendente"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "gerente", "atendente"],
    },
  },
} as const
