import java.sql.*;

public class CheckData {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:mysql://udemy-clone-db.ck9q6u08k1mw.us-east-1.rds.amazonaws.com:3306/udemy_clone";
        Connection conn = DriverManager.getConnection(url, "admin", "8870099067faby");
        
        System.out.println("\n=== USERS TABLE ===");
        ResultSet rs = conn.createStatement().executeQuery("SELECT id, first_name, last_name, email, role, created_at FROM users");
        System.out.printf("%-38s | %-20s | %-30s | %-12s%n", "ID", "Name", "Email", "Role");
        System.out.println("-".repeat(110));
        while(rs.next()) {
            String name = rs.getString("first_name") + " " + rs.getString("last_name");
            System.out.printf("%-38s | %-20s | %-30s | %-12s%n", 
                rs.getString("id"), name, rs.getString("email"), rs.getString("role"));
        }
        
        System.out.println("\n=== COURSES TABLE ===");
        rs = conn.createStatement().executeQuery("SELECT id, title, status, category FROM courses");
        System.out.printf("%-38s | %-35s | %-12s | %s%n", "ID", "Title", "Status", "Category");
        System.out.println("-".repeat(110));
        while(rs.next()) {
            System.out.printf("%-38s | %-35s | %-12s | %s%n", 
                rs.getString("id"), rs.getString("title"), rs.getString("status"), rs.getString("category"));
        }
        
        conn.close();
        System.out.println("\n Data is stored in Amazon RDS!");
    }
}
