using Microsoft.EntityFrameworkCore;

namespace GpssStudio.WebApi.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext for the GPSS editor backend.
/// </summary>
public sealed class GpssStudioDbContext : DbContext
{
    public GpssStudioDbContext(DbContextOptions<GpssStudioDbContext> options)
        : base(options)
    {
    }

    public DbSet<TebClassEntity> TebClasses => Set<TebClassEntity>();
    public DbSet<TebGpssEntityEntity> TebGpssEntities => Set<TebGpssEntityEntity>();
    public DbSet<TebPortEntity> TebPorts => Set<TebPortEntity>();
    public DbSet<TebParameterEntity> TebParameters => Set<TebParameterEntity>();
    public DbSet<TebStateEntity> TebStates => Set<TebStateEntity>();
    public DbSet<TebInstanceEntity> TebInstances => Set<TebInstanceEntity>();
    public DbSet<TebInstanceParameterValueEntity> TebInstanceParameterValues => Set<TebInstanceParameterValueEntity>();
    public DbSet<WorkspaceSnapshotEntity> WorkspaceSnapshots => Set<WorkspaceSnapshotEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TebClassEntity>(entity =>
        {
            entity.ToTable("teb_classes");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.LibraryId).HasColumnName("library_id");
            entity.Property(item => item.ClassType).HasColumnName("class_type");
            entity.Property(item => item.NameInModel).HasColumnName("name_in_model");
            entity.Property(item => item.Header).HasColumnName("header");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.ImageName).HasColumnName("image_name");
            entity.Property(item => item.ImageUrl).HasColumnName("image_url");
            entity.Property(item => item.GpssModelText).HasColumnName("gpss_model_text");
            entity.Property(item => item.GpssModelMetadata).HasColumnName("gpss_model_metadata").HasColumnType("jsonb");
        });

        modelBuilder.Entity<TebGpssEntityEntity>(entity =>
        {
            entity.ToTable("teb_gpss_entities");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ClassId).HasColumnName("class_id");
            entity.Property(item => item.SortOrder).HasColumnName("sort_order");
            entity.Property(item => item.Type).HasColumnName("type");
            entity.Property(item => item.NameInModel).HasColumnName("name_in_model");
            entity.Property(item => item.Value).HasColumnName("value");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.HasOne(item => item.Class).WithMany(item => item.GpssEntities).HasForeignKey(item => item.ClassId);
        });

        modelBuilder.Entity<TebPortEntity>(entity =>
        {
            entity.ToTable("teb_ports");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ClassId).HasColumnName("class_id");
            entity.Property(item => item.Direction).HasColumnName("direction");
            entity.Property(item => item.SortOrder).HasColumnName("sort_order");
            entity.Property(item => item.NameInModel).HasColumnName("name_in_model");
            entity.Property(item => item.Header).HasColumnName("header");
            entity.Property(item => item.ConnectedBlock).HasColumnName("connected_block");
            entity.Property(item => item.ConnectionsLimit).HasColumnName("connections_limit");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.HasOne(item => item.Class).WithMany(item => item.Ports).HasForeignKey(item => item.ClassId);
        });

        modelBuilder.Entity<TebParameterEntity>(entity =>
        {
            entity.ToTable("teb_parameters");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ClassId).HasColumnName("class_id");
            entity.Property(item => item.SortOrder).HasColumnName("sort_order");
            entity.Property(item => item.Type).HasColumnName("type");
            entity.Property(item => item.Header).HasColumnName("header");
            entity.Property(item => item.NameInModel).HasColumnName("name_in_model");
            entity.Property(item => item.DefaultValue).HasColumnName("default_value");
            entity.Property(item => item.AllowEmptyValues).HasColumnName("allow_empty_values");
            entity.Property(item => item.CurrentValue).HasColumnName("current_value");
            entity.HasOne(item => item.Class).WithMany(item => item.Parameters).HasForeignKey(item => item.ClassId);
        });

        modelBuilder.Entity<TebStateEntity>(entity =>
        {
            entity.ToTable("teb_states");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ClassId).HasColumnName("class_id");
            entity.Property(item => item.SortOrder).HasColumnName("sort_order");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Expression).HasColumnName("expression");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.HasOne(item => item.Class).WithMany(item => item.States).HasForeignKey(item => item.ClassId);
        });

        modelBuilder.Entity<TebInstanceEntity>(entity =>
        {
            entity.ToTable("teb_instances");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ClassId).HasColumnName("class_id");
            entity.Property(item => item.NameInModel).HasColumnName("name_in_model");
            entity.Property(item => item.Text).HasColumnName("text");
            entity.HasOne(item => item.Class).WithMany(item => item.Instances).HasForeignKey(item => item.ClassId);
        });

        modelBuilder.Entity<TebInstanceParameterValueEntity>(entity =>
        {
            entity.ToTable("teb_instance_parameter_values");
            entity.HasKey(item => new { item.InstanceId, item.ParameterId });
            entity.Property(item => item.InstanceId).HasColumnName("instance_id");
            entity.Property(item => item.ParameterId).HasColumnName("parameter_id");
            entity.Property(item => item.Value).HasColumnName("value");
            entity.HasOne(item => item.Instance).WithMany(item => item.ParameterValues).HasForeignKey(item => item.InstanceId);
            entity.HasOne(item => item.Parameter).WithMany(item => item.InstanceValues).HasForeignKey(item => item.ParameterId);
        });

        modelBuilder.Entity<WorkspaceSnapshotEntity>(entity =>
        {
            entity.ToTable("workspace_snapshots");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.SnapshotJson).HasColumnName("snapshot_json").HasColumnType("jsonb");
            entity.Property(item => item.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
