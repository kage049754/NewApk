package com.kage049754.newapk

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private data class WContent(val title:String,val summary:String,val lines:List<String>,val action:String,val route:String)
private data class WTheme(val surface:Int,val primary:Int,val text:Int,val muted:Int)

internal object PlannerWidgetRenderer {
    fun update(context:Context,manager:AppWidgetManager,type:String,ids:IntArray) {
        val db=openDb(context)
        try {
            val theme=readTheme(db)
            val content=readContent(db,type)
            ids.forEach { id ->
                val views=RemoteViews(context.packageName,R.layout.widget_planner)
                views.setInt(R.id.widget_root,"setBackgroundColor",theme.surface)
                views.setTextViewText(R.id.widget_title,content.title)
                views.setTextViewText(R.id.widget_summary,content.summary)
                views.setTextColor(R.id.widget_title,theme.primary)
                views.setTextColor(R.id.widget_summary,theme.muted)
                val availableHeight=manager.getAppWidgetOptions(id).getInt(
                    AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,
                    112
                )
                // Keep compact widgets readable rather than squeezing all three
                // content lines into the launcher's minimum-height footprint.
                val showSummary=availableHeight >= 140 || content.lines.isEmpty()
                views.setViewVisibility(
                    R.id.widget_summary,
                    if(showSummary) android.view.View.VISIBLE else android.view.View.GONE
                )
                listOf(R.id.widget_line_one,R.id.widget_line_two,R.id.widget_line_three).forEachIndexed { index,viewId ->
                    val line=content.lines.getOrNull(index).orEmpty()
                    val fitsHeight=when(index) {
                        0 -> true
                        1 -> availableHeight >= 160
                        else -> availableHeight >= 190
                    }
                    views.setTextViewText(viewId,line)
                    views.setTextColor(viewId,theme.text)
                    views.setViewVisibility(
                        viewId,
                        if(line.isNotBlank() && fitsHeight) android.view.View.VISIBLE else android.view.View.GONE
                    )
                }
                views.setTextViewText(R.id.widget_action,content.action)
                views.setTextColor(R.id.widget_action,Color.WHITE)
                views.setInt(R.id.widget_action,"setBackgroundColor",theme.primary)
                views.setOnClickPendingIntent(R.id.widget_root,openIntent(context,type,content.route))
                views.setOnClickPendingIntent(R.id.widget_action,openIntent(context,type+"-action",content.route))
                manager.updateAppWidget(id,views)
            }
        } finally { db?.close() }
    }

    private fun openDb(context:Context):SQLiteDatabase? {
        val file=context.getDatabasePath("newapk.db")
        if(!file.exists()) return null
        return try { SQLiteDatabase.openDatabase(file.absolutePath,null,SQLiteDatabase.OPEN_READONLY) } catch(_:Exception) { null }
    }

    private fun readContent(db:SQLiteDatabase?,type:String):WContent {
        if(db==null) return WContent("NewApk","Open the app to start your planner.",emptyList(),"Open NewApk","home")
        return try {
            when(type) {
                "today_classes" -> todayClasses(db)
                "weekly_schedule" -> weeklySchedule(db)
                "upcoming_tasks" -> upcomingTasks(db)
                "deadline_overview" -> deadlines(db)
                "budget_overview" -> budget(db)
                "savings_goals" -> savings(db)
                "quick_expense" -> WContent("Quick Expense","Record an expense directly in Budget.",listOf("Choose the amount and category.","Your monthly totals update automatically."),"＋ Add expense","budget/add-expense")
                else -> WContent("NewApk","Your offline student planner.",emptyList(),"Open NewApk","home")
            }
        } catch(_:Exception) { WContent("NewApk","Open NewApk to refresh this widget.",emptyList(),"Open app","home") }
    }

    private fun todayClasses(db:SQLiteDatabase):WContent {
        val day=Calendar.getInstance().get(Calendar.DAY_OF_WEEK)-Calendar.SUNDAY
        val lines=mutableListOf<String>()
        db.rawQuery("SELECT c.start_time,c.end_time,c.room,c.class_type,s.name,s.code,s.room AS subject_room FROM classes c LEFT JOIN subjects s ON s.id=c.subject_id WHERE c.day_of_week=? ORDER BY c.start_time LIMIT 3",arrayOf(day.toString())).use { c ->
            while(c.moveToNext()) {
                val subject=c.text("code").ifBlank { c.text("name").ifBlank { "Class" } }
                val room=c.text("room").ifBlank { c.text("subject_room") }
                lines.add(listOf(clock(c.text("start_time"))+"–"+clock(c.text("end_time")),subject,c.text("class_type"),room).filter { it.isNotBlank() }.joinToString(" · "))
            }
        }
        val count=scalar(db,"SELECT COUNT(*) FROM classes WHERE day_of_week=?",arrayOf(day.toString()))
        val suffix=if(count==1) " class today" else " classes today"
        return WContent("Today's Classes",if(count==0) "No classes scheduled today." else count.toString()+suffix,lines,"Open schedule","schedule/today")
    }

    private fun weeklySchedule(db:SQLiteDatabase):WContent {
        val today=Calendar.getInstance().get(Calendar.DAY_OF_WEEK)-Calendar.SUNDAY
        val lines=mutableListOf<String>()
        db.rawQuery("SELECT c.day_of_week,c.start_time,c.room,c.class_type,s.name,s.code,s.room AS subject_room FROM classes c LEFT JOIN subjects s ON s.id=c.subject_id ORDER BY ((c.day_of_week-?+7)%7),c.start_time LIMIT 3",arrayOf(today.toString())).use { c ->
            while(c.moveToNext()) {
                val day=DAYS.getOrElse(c.getInt(c.getColumnIndexOrThrow("day_of_week"))) { "Day" }
                val subject=c.text("code").ifBlank { c.text("name").ifBlank { "Class" } }
                val room=c.text("room").ifBlank { c.text("subject_room") }
                lines.add(listOf(day,clock(c.text("start_time")),subject,c.text("class_type"),room).filter { it.isNotBlank() }.joinToString(" · "))
            }
        }
        val count=scalar(db,"SELECT COUNT(*) FROM classes")
        val suffix=if(count==1) " scheduled class" else " scheduled classes"
        return WContent("Weekly Schedule",if(count==0) "Add classes to see your week." else count.toString()+suffix,lines,"Open timetable","schedule/week")
    }

    private fun upcomingTasks(db:SQLiteDatabase):WContent {
        val lines=mutableListOf<String>()
        db.rawQuery("SELECT title,due_at FROM tasks WHERE completed=0 ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,due_at ASC,id DESC LIMIT 3",null).use { c ->
            while(c.moveToNext()) {
                val title=c.text("title")
                val date=c.text("due_at").take(10)
                lines.add(if(date.isBlank()) title else title+" · "+dateLabel(date))
            }
        }
        val count=scalar(db,"SELECT COUNT(*) FROM tasks WHERE completed=0")
        return WContent("Upcoming Tasks",if(count==0) "No pending tasks." else count.toString()+" tasks to finish",lines,"Open tasks","tasks/upcoming")
    }

    private fun deadlines(db:SQLiteDatabase):WContent {
        val today=todayKey()
        val lines=mutableListOf<String>()
        db.rawQuery("SELECT title,due_at FROM tasks WHERE completed=0 AND due_at IS NOT NULL ORDER BY due_at ASC,id DESC LIMIT 3",null).use { c ->
            while(c.moveToNext()) {
                val date=c.text("due_at").take(10)
                val label=when { date<today -> "Overdue · "+dateLabel(date); date==today -> "Due today"; else -> "Due "+dateLabel(date) }
                lines.add(c.text("title")+" · "+label)
            }
        }
        val count=scalar(db,"SELECT COUNT(*) FROM tasks WHERE completed=0 AND due_at IS NOT NULL")
        return WContent("Deadline Overview",if(count==0) "No dated deadlines." else count.toString()+" open deadlines",lines,"View deadlines","tasks/deadlines")
    }

    private fun budget(db:SQLiteDatabase):WContent {
        var income=0.0
        var expenses=0.0
        db.rawQuery("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0),COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) FROM budget_transactions WHERE strftime('%Y-%m',occurred_at,'localtime')=strftime('%Y-%m','now','localtime')",null).use { c ->
            if(c.moveToFirst()) { income=c.getDouble(0); expenses=c.getDouble(1) }
        }
        val limit=db.rawQuery("SELECT limit_amount FROM monthly_budgets WHERE month=strftime('%Y-%m','now','localtime') LIMIT 1",null).use { c -> if(c.moveToFirst()) c.getDouble(0) else 0.0 }
        val lines=listOf("Income · "+money(income),"Expenses · "+money(expenses),if(limit>0) "Limit left · "+money(limit-expenses) else "Monthly limit not set")
        return WContent("Budget Overview","Balance · "+money(income-expenses),lines,"Open Budget","budget")
    }

    private fun savings(db:SQLiteDatabase):WContent {
        val lines=mutableListOf<String>()
        db.rawQuery("SELECT title,saved_amount,target_amount FROM savings_goals ORDER BY id DESC LIMIT 3",null).use { c ->
            while(c.moveToNext()) {
                val saved=c.getDouble(c.getColumnIndexOrThrow("saved_amount"))
                val target=c.getDouble(c.getColumnIndexOrThrow("target_amount"))
                val pct=if(target>0) (saved/target*100).toInt() else 0
                lines.add(c.text("title")+" · "+pct+"% · "+money(saved)+" / "+money(target))
            }
        }
        val count=scalar(db,"SELECT COUNT(*) FROM savings_goals")
        return WContent("Savings Goals",if(count==0) "Create a savings goal in Budget." else count.toString()+" savings goals",lines,"Open savings","budget/savings")
    }

    private fun readTheme(db:SQLiteDatabase?):WTheme {
        val forest=WTheme(Color.WHITE,Color.rgb(69,102,77),Color.DKGRAY,Color.GRAY)
        if(db==null) return forest
        return try {
            var name="Forest"
            var custom=""
            db.rawQuery("SELECT key,value FROM settings WHERE key IN ('appearance_palette','appearance_custom_palette')",null).use { c ->
                while(c.moveToNext()) when(c.text("key")) {
                    "appearance_palette" -> name=c.text("value")
                    "appearance_custom_palette" -> custom=c.text("value")
                }
            }
            val defaults=when(name) {
                "Sunset" -> listOf("#FFFCF8","#C66F50","#49332C","#92766B")
                "Monochrome" -> listOf("#FFFFFF","#303030","#202020","#777777")
                "Night" -> listOf("#222B25","#A7C7A9","#F1F3EC","#A5B0A5")
                else -> listOf("#FFFEF8","#45664D","#26372B","#788477")
            }
            val colors=if(name=="Custom" && custom.isNotBlank()) {
                val json=JSONObject(custom)
                listOf("surface","primary","text","muted").map { key ->
                    json.optString(key).takeIf { it.matches(Regex("^#[0-9a-fA-F]{6}$")) } ?: "#45664D"
                }
            } else defaults
            WTheme(Color.parseColor(colors[0]),Color.parseColor(colors[1]),Color.parseColor(colors[2]),Color.parseColor(colors[3]))
        } catch(_:Exception) { forest }
    }

    private fun openIntent(context:Context,key:String,route:String):PendingIntent {
        val intent=Intent(context,MainActivity::class.java).apply {
            action=Intent.ACTION_VIEW
            data=Uri.parse("newapk://"+route)
            flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val code=(key.hashCode() and 0x7fffffff).let { if(it==0) 1 else it }
        return PendingIntent.getActivity(context,code,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun scalar(db:SQLiteDatabase,sql:String,args:Array<String> = emptyArray()):Int =
        db.rawQuery(sql,args).use { c -> if(c.moveToFirst()) c.getInt(0) else 0 }

    private fun Cursor.text(name:String):String {
        val i=getColumnIndex(name)
        return if(i>=0 && !isNull(i)) getString(i).orEmpty() else ""
    }

    private fun clock(value:String):String {
        val p=value.split(":")
        val h=p.getOrNull(0)?.toIntOrNull() ?: return value
        val m=p.getOrNull(1) ?: "00"
        return (if(h%12==0) 12 else h%12).toString()+":"+m+" "+(if(h>=12) "PM" else "AM")
    }

    private fun dateLabel(value:String):String = try {
        SimpleDateFormat("yyyy-MM-dd",Locale.US).apply { isLenient=false }.parse(value)?.let {
            SimpleDateFormat("MMM d",Locale.getDefault()).format(it)
        } ?: value
    } catch(_:Exception) { value }

    private fun todayKey()=SimpleDateFormat("yyyy-MM-dd",Locale.US).format(Date())
    private fun money(value:Double)=String.format(Locale.getDefault(),"₱%,.2f",value)
    private val DAYS=listOf("Sun","Mon","Tue","Wed","Thu","Fri","Sat")
}

abstract class BasePlannerWidgetProvider:AppWidgetProvider() {
    abstract val widgetType:String
    override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray) {
        PlannerWidgetRenderer.update(context,manager,widgetType,ids)
    }
    override fun onAppWidgetOptionsChanged(
        context:Context,
        manager:AppWidgetManager,
        appWidgetId:Int,
        newOptions:android.os.Bundle
    ) {
        // Rerender after a launcher resize so compact and expanded layouts
        // use the correct number of summary rows.
        PlannerWidgetRenderer.update(context,manager,widgetType,intArrayOf(appWidgetId))
    }
}
class TodayClassesWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="today_classes" }
class WeeklyScheduleWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="weekly_schedule" }
class UpcomingTasksWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="upcoming_tasks" }
class DeadlineOverviewWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="deadline_overview" }
class BudgetOverviewWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="budget_overview" }
class SavingsGoalsWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="savings_goals" }
class QuickExpenseWidgetProvider:BasePlannerWidgetProvider(){ override val widgetType="quick_expense" }

/**
 * Refresh date-dependent widgets when the system date, time, timezone or boot
 * state changes. This keeps "Today's Classes" and monthly totals current even
 * when NewApk has not been opened since the last system change.
 */
class PlannerWidgetRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context:Context,intent:Intent?) {
        when(intent?.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_BOOT_COMPLETED -> {
                try {
                    PlannerWidgetRegistry.refreshAll(context)
                } catch (_:Exception) {
                    // Never block system time or boot handling for widget updates.
                }
            }
        }
    }
}

internal object PlannerWidgetRegistry {
    private val providers=listOf(
        "today_classes" to TodayClassesWidgetProvider::class.java,
        "weekly_schedule" to WeeklyScheduleWidgetProvider::class.java,
        "upcoming_tasks" to UpcomingTasksWidgetProvider::class.java,
        "deadline_overview" to DeadlineOverviewWidgetProvider::class.java,
        "budget_overview" to BudgetOverviewWidgetProvider::class.java,
        "savings_goals" to SavingsGoalsWidgetProvider::class.java,
        "quick_expense" to QuickExpenseWidgetProvider::class.java,
    )
    fun refreshAll(context:Context) {
        val manager=AppWidgetManager.getInstance(context)
        providers.forEach { (type,provider) ->
            val ids=manager.getAppWidgetIds(ComponentName(context,provider))
            if(ids.isNotEmpty()) PlannerWidgetRenderer.update(context,manager,type,ids)
        }
    }

    fun requestPin(context:Context,type:String):Boolean {
        if(Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val provider=providers.firstOrNull { it.first==type }?.second
            ?: throw IllegalArgumentException("Unknown NewApk widget: $type")
        val manager=AppWidgetManager.getInstance(context)
        if(!manager.isRequestPinAppWidgetSupported) return false
        // The launcher displays its own confirmation; true means the request
        // was accepted by the launcher API, not that the widget is already pinned.
        return manager.requestPinAppWidget(ComponentName(context,provider),null,null)
    }
}

class PlannerWidgetsModule(private val context:com.facebook.react.bridge.ReactApplicationContext):com.facebook.react.bridge.ReactContextBaseJavaModule(context) {
    override fun getName()="PlannerWidgets"
    @com.facebook.react.bridge.ReactMethod
    fun refreshAll(promise:com.facebook.react.bridge.Promise) {
        try { PlannerWidgetRegistry.refreshAll(context); promise.resolve(true) }
        catch(error:Exception) { promise.reject("E_WIDGET_REFRESH",error.message ?: "Could not refresh widgets.",error) }
    }

    @com.facebook.react.bridge.ReactMethod
    fun requestPin(widgetType:String,promise:com.facebook.react.bridge.Promise) {
        try { promise.resolve(PlannerWidgetRegistry.requestPin(context,widgetType)) }
        catch(error:Exception) { promise.reject("E_WIDGET_PIN",error.message ?: "Could not request widget placement.",error) }
    }
}
