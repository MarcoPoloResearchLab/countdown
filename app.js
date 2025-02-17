const app = Vue.createApp({
    data() {
        return {
            startDate: "",
            endDate: "",
            vacations: [],
            workingDaysLeft: 0,
            totalDaysLeft: 0,
            workingHoursLeft: 0,
            totalHoursLeft: 0,
            totalSecondsLeft: 0,
            weeksLeft: 0,
            selectedMetric: "workingDays",
            metricOptions: [
                { value: "workingDays", label: "Working Days Left" },
                { value: "totalDays", label: "Total Days Left" },
                { value: "workingHours", label: "Working Hours Left" },
                { value: "totalHours", label: "Total Hours Left" },
                { value: "totalSeconds", label: "Total Seconds Left" },
                { value: "weeksLeft", label: "Weeks Left" }
            ],
            today: new Date().toISOString().split("T")[0],
            currentMonth: new Date(),
            dayHeaders: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            user: null, // Stores the user object (name, email, picture, etc.)
            errorMessage: null
        };
    },
    computed: {
        monthYear() {
            return this.currentMonth.toLocaleString("default", { month: "long", year: "numeric" });
        },
        calendarDays() {
            const yearValue = this.currentMonth.getFullYear();
            const monthValue = this.currentMonth.getMonth();
            const firstDay = new Date(yearValue, monthValue, 1);
            const lastDay = new Date(yearValue, monthValue + 1, 0);
            const days = [];
            const now = new Date();

            // Fill leading days (previous month)
            for (let dayIndex = 0; dayIndex < firstDay.getDay(); dayIndex++) {
                const tempDate = new Date(yearValue, monthValue, -dayIndex);
                days.unshift({ date: tempDate, otherMonth: true, isToday: false });
            }

            // Fill current month
            for (let dateNumber = 1; dateNumber <= lastDay.getDate(); dateNumber++) {
                const tempDate = new Date(yearValue, monthValue, dateNumber);
                days.push({
                    date: tempDate,
                    otherMonth: false,
                    isToday: tempDate.toDateString() === now.toDateString()
                });
            }

            // Fill trailing days (next month)
            const leftoverCells = 7 - (days.length % 7);
            if (leftoverCells < 7) {
                for (let dateNumber = 1; dateNumber <= leftoverCells; dateNumber++) {
                    const tempDate = new Date(yearValue, monthValue + 1, dateNumber);
                    days.push({ date: tempDate, otherMonth: true, isToday: false });
                }
            }

            return days;
        },
        metricLabel() {
            switch (this.selectedMetric) {
                case "workingDays":
                    return "Working Days Left";
                case "workingHours":
                    return "Working Hours Left";
                case "totalDays":
                    return "Total Days Left";
                case "totalHours":
                    return "Total Hours Left";
                case "totalSeconds":
                    return "Total Seconds Left";
                case "weeksLeft":
                    return "Weeks Left";
                default:
                    return "Metric";
            }
        },
        displayValue() {
            switch (this.selectedMetric) {
                case "workingDays":
                    return this.workingDaysLeft;
                case "workingHours":
                    return this.workingHoursLeft;
                case "totalDays":
                    return this.totalDaysLeft;
                case "totalHours":
                    return this.totalHoursLeft;
                case "totalSeconds":
                    return this.totalSecondsLeft;
                case "weeksLeft":
                    return this.weeksLeft;
                default:
                    return 0;
            }
        }
    },
    watch: {
        // Watch startDate and endDate. When they change, update metrics and save the dates.
        startDate(newVal) {
            this.calcAllMetrics();
            this.saveDates();
        },
        endDate(newVal) {
            this.calcAllMetrics();
            this.saveDates();
        },
        // Watch user changes. (Note: the "immediate" flag has been removed so that initial null does not wipe out saved dates.)
        user: {
            handler(newUser) {
                if (newUser) {
                    // User is logged in; restore any saved dates then update metrics.
                    this.restoreDates();
                    this.calcAllMetrics();
                } else {
                    // User logged out: set fresh defaults and clear stored dates.
                    this.startDate = this.today;
                    this.endDate = "";
                    localStorage.removeItem("dates");
                }
            },
            deep: true
        }
    },
    methods: {
        // Saves only the startDate and endDate to localStorage.
        saveDates() {
            const dates = {
                startDate: this.startDate,
                endDate: this.endDate
            };
            localStorage.setItem("dates", JSON.stringify(dates));
        },

        // Restores the startDate and endDate from localStorage.
        restoreDates() {
            const savedDates = localStorage.getItem("dates");
            if (savedDates) {
                const dates = JSON.parse(savedDates);
                this.startDate = dates.startDate || this.today;
                this.endDate = dates.endDate || "";
            }
        },

        handleSignOut() {
            // Sign-out logic: clear the user and stored dates.
            this.user = null;
            this.errorMessage = null;
            localStorage.removeItem("user");
            localStorage.removeItem("dates");
            google.accounts.id.disableAutoSelect();
        },

        handleCredentialResponse(response) {
            // Handle the Google sign-in flow.
            try {
                const decodedToken = this.parseJwt(response.credential);
                if (!decodedToken) {
                    throw new Error("Invalid token received.");
                }
                this.user = decodedToken;
                this.errorMessage = null;
                localStorage.setItem("user", JSON.stringify(decodedToken));

                // With a logged-in user, restore dates and update metrics.
                this.restoreDates();
                this.calcAllMetrics();
            } catch (error) {
                this.errorMessage = "Authentication failed. Please try again.";
                console.error("Authentication error:", error);
            }
        },

        parseJwt(token) {
            try {
                return JSON.parse(atob(token.split('.')[1]));
            } catch (error) {
                return null;
            }
        },

        initializeGoogleSignIn() {
            google.accounts.id.initialize({
                client_id: '74022320040-5aaq169bkriqitue3dcqi8g2o3vk5q16.apps.googleusercontent.com',
                callback: this.handleCredentialResponse.bind(this)
            });
            google.accounts.id.renderButton(
                document.getElementById('googleSignInButton'),
                { theme: 'outline', size: 'large' }
            );
        },

        calcAllMetrics() {
            if (!this.startDate || !this.endDate) {
                this.workingDaysLeft = 0;
                this.totalDaysLeft = 0;
                this.workingHoursLeft = 0;
                this.totalHoursLeft = 0;
                this.totalSecondsLeft = 0;
                this.weeksLeft = 0;
                return;
            }
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            let totalDays = 0;
            if (end >= start) {
                totalDays = Math.floor((end - start) / (1000 * 3600 * 24)) + 1;
            }
            let workingDays = 0;
            for (let tempDate = new Date(start); tempDate <= end; tempDate.setDate(tempDate.getDate() + 1)) {
                if (this.isWorkingDay(tempDate) && !this.isVacationDay(tempDate)) {
                    workingDays++;
                }
            }
            this.workingDaysLeft = workingDays;
            this.totalDaysLeft = totalDays;
            this.workingHoursLeft = workingDays * 8;
            this.totalHoursLeft = totalDays * 24;
            this.totalSecondsLeft = this.totalHoursLeft * 3600;
            this.weeksLeft = Math.floor(totalDays / 7);
        },

        isWorkingDay(dateValue) {
            const dayOfWeek = dateValue.getDay();
            const yearValue = dateValue.getFullYear();
            const holidays = this.getUSHolidays(yearValue);
            const dateStr = dateValue.toISOString().split("T")[0];
            return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr);
        },

        getUSHolidays(yearValue) {
            const holidays = [
                `${yearValue}-01-01`, // New Year's Day
                this.getNthWeekdayOfMonth(yearValue, 1, 1, 3), // MLK Day (3rd Monday in January)
                this.getNthWeekdayOfMonth(yearValue, 2, 1, 3), // Presidents Day (3rd Monday in February)
                this.getLastWeekdayOfMonth(yearValue, 5, 1),   // Memorial Day (Last Monday in May)
                `${yearValue}-06-19`, // Juneteenth
                `${yearValue}-07-04`, // Independence Day
                this.getNthWeekdayOfMonth(yearValue, 9, 1, 1), // Labor Day (1st Monday in September)
                this.getNthWeekdayOfMonth(yearValue, 10, 1, 2),// Columbus Day (2nd Monday in October)
                `${yearValue}-11-11`, // Veterans Day
                this.getNthWeekdayOfMonth(yearValue, 11, 4, 4),// Thanksgiving (4th Thursday in November)
                `${yearValue}-12-25`  // Christmas
            ];

            // Handle weekend holidays: adjust if necessary.
            const adjustedHolidays = holidays.map(holiday => {
                const date = new Date(holiday);
                const day = date.getDay();
                if (day === 6) { // Saturday: observe Friday
                    date.setDate(date.getDate() - 1);
                    return date.toISOString().split('T')[0];
                }
                if (day === 0) { // Sunday: observe Monday
                    date.setDate(date.getDate() + 1);
                    return date.toISOString().split('T')[0];
                }
                return holiday;
            });
            return adjustedHolidays;
        },

        getNthWeekdayOfMonth(yearValue, monthNumber, weekdayNumber, occurrenceNumber) {
            const date = new Date(yearValue, monthNumber - 1, 1);
            let count = 0;
            while (count < occurrenceNumber) {
                if (date.getDay() === weekdayNumber) {
                    count++;
                }
                if (count < occurrenceNumber) {
                    date.setDate(date.getDate() + 1);
                }
            }
            return date.toISOString().split('T')[0];
        },

        getLastWeekdayOfMonth(yearValue, monthNumber, weekdayNumber) {
            const tempDate = new Date(yearValue, monthNumber, 0);
            const tempWeekday = tempDate.getDay();
            const difference = (tempWeekday - weekdayNumber + 7) % 7;
            const dayInMonth = tempDate.getDate() - difference;
            return new Date(yearValue, monthNumber - 1, dayInMonth).toISOString().split("T")[0];
        },

        isVacationDay(dateValue) {
            for (const vac of this.vacations) {
                if (!vac.start || !vac.end) continue;
                const vacationStart = new Date(vac.start);
                const vacationEnd = new Date(vac.end);
                if (dateValue >= vacationStart && dateValue <= vacationEnd) return true;
            }
            return false;
        },

        addVacation() {
            this.vacations.push({ start: "", end: "" });
        },

        removeVacation(indexValue) {
            this.vacations.splice(indexValue, 1);
        },

        onVacationChange(indexValue) {
            const vac = this.vacations[indexValue];
            if (vac.start) {
                const startDateValue = new Date(vac.start);
                const nextDay = new Date(startDateValue);
                nextDay.setDate(startDateValue.getDate() + 1);
                const formatted = nextDay.toISOString().split("T")[0];
                if (!vac.end || vac.end < vac.start) {
                    this.vacations[indexValue].end = formatted;
                }
            }
            this.calcAllMetrics();
        },

        previousMonth() {
            this.currentMonth = new Date(
                this.currentMonth.getFullYear(),
                this.currentMonth.getMonth() - 1,
                1
            );
        },

        nextMonth() {
            this.currentMonth = new Date(
                this.currentMonth.getFullYear(),
                this.currentMonth.getMonth() + 1,
                1
            );
        }
    },
    mounted() {
        // Restore user from localStorage if available.
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            this.user = JSON.parse(savedUser);
            // Note: the user watcher will then call restoreDates() and calcAllMetrics()
        } else {
            // No saved user – start with default dates.
            this.startDate = this.today;
        }

        // Initialize Google Sign-In.
        if (window.google) {
            this.initializeGoogleSignIn();
        } else {
            window.onload = () => this.initializeGoogleSignIn();
        }

        // Run metric calculation for initial display.
        this.calcAllMetrics();
    }
});

app.mount("#app");